import { once } from "node:events";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const INTERACTIVE =
  'a[href],button,input,textarea,select,summary,[role="switch"],[role="menuitem"],[role="checkbox"],[role="tab"],[tabindex]:not([tabindex="-1"])';
const SIGNED_OUT_URL = `http://localhost:${process.env.MEDIAHOOKS_STYLE_PORTS!.split(",")[1]}/`;
const FIXED_TIME = new Date("2026-01-15T12:00:00Z");
const OUT = resolve(process.env.OUT ?? "test/style-guard/current.json");

const PROFILES = {
  desktop: { viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false },
  mobile: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true },
} as const;

type Dump = { defaults: Record<string, Record<string, string>>; nodes: Record<string, Record<string, string>> };

let active: number;
let paused: number;
let receiverStatus = 200;
const receiver = createServer((req, res) => {
  req.resume();
  res.writeHead(receiverStatus, { "content-type": "text/plain" }).end(receiverStatus === 200 ? "ok" : "rejected");
});

test.beforeAll(async ({ request }) => {
  await once(receiver.listen(0, "127.0.0.1"), "listening");
  const receiverUrl = `http://127.0.0.1:${(receiver.address() as { port: number }).port}/hook`;
  const create = async (name: string, enabled: boolean, url = "http://127.0.0.1:9/hook") => {
    const res = await request.post("/api/webhooks", {
      data: { name, url, events: ["library.new", "media.play"], enabled },
    });
    expect(res.ok()).toBe(true);
    return ((await res.json()) as { id: number }).id;
  };
  active = await create("Living room alerts", true, receiverUrl);
  paused = await create("Paused webhook", false);
  await create("Delete me", true);
  await create("Delete me too", true);
  await create("Toggle me", true);

  const meta = await (await request.get("/api/meta")).json();
  const send = async (event: string, title: string) => {
    const res = await request.post(`/plex?token=${meta.ingestToken}`, {
      data: { event, Metadata: { type: "movie", title, year: 2016 } },
    });
    expect(res.ok()).toBe(true);
  };
  const deliveries = async () => (await (await request.get(`/api/webhooks/${active}/deliveries`)).json()).length as number;

  await send("media.play", "Arrival");
  await expect.poll(deliveries).toBe(1);
  receiverStatus = 400;
  await send("media.play", "Sicario");
  await expect.poll(deliveries).toBe(2);
  await send("media.pause", "Arrival");
  await expect.poll(async () => (await (await request.get("/api/events")).json()).length).toBe(3);
});

test.afterAll(() => {
  receiver.close();
});

function installGuard(INTERACTIVE: string) {
  const SKIP = new Set(["script", "style", "link", "meta", "title", "head", "noscript", "base"]);
  const label = (el: Element) => (el.namespaceURI === "http://www.w3.org/1999/xhtml" ? "" : "svg:") + el.localName;
  const read = (cs: CSSStyleDeclaration) => {
    const o: Record<string, string> = {};
    for (const k of Array.from(cs).sort()) o[k] = cs.getPropertyValue(k);
    return o;
  };
  const defaults: Record<string, Record<string, string>> = {};
  let sandbox: HTMLIFrameElement | null = null;
  const defaultFor = (el: Element, name: string) => {
    if (!defaults[name]) {
      if (!sandbox) {
        sandbox = document.createElement("iframe");
        sandbox.style.cssText = "position:absolute;visibility:hidden";
        document.body.append(sandbox);
      }
      const sdoc = sandbox.contentDocument!;
      const fresh = sdoc.createElementNS(el.namespaceURI, el.localName);
      const host = el.namespaceURI === "http://www.w3.org/2000/svg" ? sdoc.createElementNS("http://www.w3.org/2000/svg", "svg") : sdoc.body;
      host.append(fresh);
      if (host !== sdoc.body) sdoc.body.append(host);
      defaults[name] = read(sandbox.contentWindow!.getComputedStyle(fresh));
    }
    return defaults[name]!;
  };
  const pathOf = (el: Element) => {
    const parts: string[] = [];
    for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) {
      const same = n.parentElement ? [...n.parentElement.children].filter((c) => label(c) === label(n!)) : [n];
      parts.unshift(`${label(n)}[${same.indexOf(n) + 1}]`);
    }
    return ["html", ...parts].join(">");
  };
  const visit = (el: Element, path: string, nodes: Record<string, Record<string, string>>) => {
    const def = defaultFor(el, label(el));
    const cs = read(getComputedStyle(el));
    const diff: Record<string, string> = {};
    for (const k in cs) if (cs[k] !== def[k]) diff[k] = cs[k]!;
    nodes[path] = diff;
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(el, pseudo);
      const content = ps.getPropertyValue("content");
      if (content && content !== "none" && content !== "normal") nodes[path + pseudo] = read(ps);
    }
  };
  const walk = (el: Element, path: string, nodes: Record<string, Record<string, string>>) => {
    if (SKIP.has(el.localName)) return;
    visit(el, path, nodes);
    const seen: Record<string, number> = {};
    for (const c of el.children) {
      if (SKIP.has(c.localName)) continue;
      const l = label(c);
      seen[l] = (seen[l] ?? 0) + 1;
      walk(c, `${path}>${l}[${seen[l]}]`, nodes);
    }
  };
  const targets = () => [...document.querySelectorAll(INTERACTIVE)].filter((e) => e.getClientRects().length > 0);
  const finite = () => document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity);
  const settle = async () => {
    await document.fonts.ready;
    for (const a of finite()) a.finish();
    for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations === Infinity) a.cancel();
  };
  const one = (i: number) => {
    const nodes: Record<string, Record<string, string>> = {};
    const el = targets()[i];
    if (el) visit(el, pathOf(el), nodes);
    return nodes;
  };
  (window as any).__sg = {
    settle,
    defaults: () => defaults,
    count: () => targets().length,
    box: (i: number) => {
      const r = targets()[i]?.getBoundingClientRect();
      return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
    },
    page: () => {
      const nodes: Record<string, Record<string, string>> = {};
      walk(document.documentElement, "html", nodes);
      return nodes;
    },
    hovered: async (i: number) => {
      await settle();
      return one(i);
    },
    focusAll: async () => {
      const out: Record<string, Record<string, string>> = {};
      const n = targets().length;
      for (let i = 0; i < n; i++) {
        const el = targets()[i];
        if (el instanceof HTMLElement) el.focus();
        await settle();
        Object.assign(out, Object.fromEntries(Object.entries(one(i)).map(([p, v]) => [`${p}@focus`, v])));
        (document.activeElement as HTMLElement | null)?.blur();
      }
      return out;
    },
  };
}

const ROUTES: [string, () => string][] = [
  ["root", () => "/"],
  ["events", () => "/events"],
  ["help", () => "/help"],
  ["new", () => "/new"],
  ["webhook", () => `/webhooks/${active}`],
  ["webhook-edit", () => `/webhooks/${active}/edit`],
  ["webhook-paused", () => `/webhooks/${paused}`],
];

type State = [string, (page: Page) => Promise<void>];

const STATES: State[] = [
  ...ROUTES.map(([name, path]): State => [
    name,
    async (page) => {
      await page.goto(path());
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("main").getByRole("heading", { level: 2 }).first()).toBeAttached();
    },
  ]),
  [
    "signed-out",
    async (page) => {
      await page.goto(SIGNED_OUT_URL);
      await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    },
  ],
  [
    "row-menu",
    async (page) => {
      await page.goto("/");
      await page.getByRole("button", { name: "More actions for Living room alerts" }).click();
      await expect(page.getByRole("menu")).toBeVisible();
    },
  ],
  [
    "undo-toast",
    async (page) => {
      await page.goto("/");
      await page.getByRole("button", { name: "More actions for Delete me", exact: true }).click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await expect(page.getByRole("button", { name: "Undo deleting Delete me", exact: true })).toBeVisible();
    },
  ],
  [
    "new-dialog",
    async (page) => {
      await page.goto("/");
      await page.locator("#new-hook").click();
      await expect(page.getByRole("dialog", { name: "New webhook" })).toBeVisible();
    },
  ],
  [
    "new-dialog-over-toast",
    async (page) => {
      await page.goto("/");
      await page.getByRole("button", { name: "More actions for Delete me too" }).click();
      await page.getByRole("menuitem", { name: "Delete" }).dispatchEvent("click");
      await expect(page.getByRole("button", { name: "Undo deleting Delete me too" })).toBeVisible();
      await page.locator("#new-hook").click();
      await expect(page.getByRole("dialog", { name: "New webhook" })).toBeVisible();
    },
  ],
  [
    "editor-failed-save",
    async (page) => {
      await page.goto("/new");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.locator(".field-error").first()).toBeVisible();
    },
  ],
  [
    "detail-after-row",
    async (page) => {
      await page.goto("/");
      await page.getByRole("link", { name: /Living room alerts/ }).press("Enter");
      await expect(page.getByRole("heading", { level: 2, name: "Living room alerts" })).toBeFocused();
    },
  ],
  [
    "events-open",
    async (page) => {
      await page.goto("/events");
      const rows = page.getByRole("main").getByRole("button", { expanded: false });
      await expect(rows).toHaveCount(3);
      for (let i = 0; i < 3; i++) await rows.first().click();
      await expect(page.locator(".ev-routing")).toHaveCount(3);
    },
  ],
  [
    "failed-toggle-toast",
    async (page) => {
      await page.route("**/api/webhooks/*", (route) =>
        route.request().method() === "PUT" ? route.fulfill({ status: 500, json: { error: "database is locked" } }) : route.continue(),
      );
      await page.goto("/");
      await page.getByRole("switch", { name: "Disable Toggle me" }).click();
      await expect(page.getByRole("button", { name: /^Dismiss: Couldn't pause Toggle me/ })).toBeVisible();
    },
  ],
];

test("dump computed styles", async ({ browser }) => {
  test.setTimeout(120_000);
  const out: Record<string, Dump> = {};
  for (const [profile, opts] of Object.entries(PROFILES)) {
    for (const [name, setup] of STATES) {
      const context = await browser.newContext({ ...opts, reducedMotion: "reduce", baseURL: `http://localhost:${process.env.MEDIAHOOKS_STYLE_PORTS!.split(",")[0]}` });
      await context.addInitScript(installGuard, INTERACTIVE);
      const page = await context.newPage();
      await page.clock.setFixedTime(FIXED_TIME);
      await setup(page);
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => (window as any).__sg.settle());
      const key = `${profile}/${name}`;
      const nodes: Dump["nodes"] = await page.evaluate(() => (window as any).__sg.page());
      out[key] = { defaults: {}, nodes };

      const fine = await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches);
      if (fine) {
        const count: number = await page.evaluate(() => (window as any).__sg.count());
        for (let i = 0; i < count; i++) {
          const box = await page.evaluate((i) => (window as any).__sg.box(i), i);
          if (!box) continue;
          await page.mouse.move(box.x, box.y);
          const hovered: Dump["nodes"] = await page.evaluate((i) => (window as any).__sg.hovered(i), i);
          for (const [p, v] of Object.entries(hovered)) nodes[`${p}@hover`] = v;
          await page.mouse.move(0, 0);
        }
      }
      await page.keyboard.press("Shift");
      const focused: Dump["nodes"] = await page.evaluate(() => (window as any).__sg.focusAll());
      Object.assign(nodes, focused);
      out[key].defaults = await page.evaluate(() => (window as any).__sg.defaults());
      await context.close();
    }
  }
  mkdirSync(dirname(OUT), { recursive: true });
  const json = JSON.stringify(out);
  writeFileSync(OUT, OUT.endsWith(".gz") ? gzipSync(json, { level: 9 }) : json);
});
