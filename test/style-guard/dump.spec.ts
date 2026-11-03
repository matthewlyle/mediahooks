import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const INTERACTIVE =
  'a[href],button,input,textarea,select,summary,[role="switch"],[role="menuitem"],[role="checkbox"],[role="tab"],[tabindex]:not([tabindex="-1"])';
const SIGNED_OUT_URL = "http://localhost:8840/";
const FIXED_TIME = new Date("2026-01-15T12:00:00Z");
const OUT = resolve(process.env.OUT ?? "test/style-guard/current.json");

const PROFILES = {
  desktop: { viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false },
  mobile: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true },
} as const;

type Dump = { defaults: Record<string, Record<string, string>>; nodes: Record<string, Record<string, string>> };

let active: number;
let paused: number;

test.beforeAll(async ({ request }) => {
  const create = async (name: string, enabled: boolean) => {
    const res = await request.post("/api/webhooks", {
      data: { name, url: "http://127.0.0.1:9/hook", events: ["library.new", "media.play"], enabled },
    });
    expect(res.ok()).toBe(true);
    return ((await res.json()) as { id: number }).id;
  };
  active = await create("Living room alerts", true);
  paused = await create("Paused webhook", false);
  await create("Delete me", true);
  await create("Toggle me", true);

  const meta = await (await request.get("/api/meta")).json();
  const sent = await request.post(`/plex?token=${meta.ingestToken}`, {
    data: { event: "media.play", Metadata: { type: "movie", title: "Arrival", year: 2016 } },
  });
  expect(sent.ok()).toBe(true);
  await expect.poll(async () => (await (await request.get("/api/events")).json()).length).toBeGreaterThan(0);
});

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    await document.fonts.ready;
    const finite = () => document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity);
    while (finite().some((a) => a.playState === "running")) await Promise.allSettled(finite().map((a) => a.finished));
    for (const a of document.getAnimations()) if (a.effect?.getComputedTiming().iterations === Infinity) a.cancel();
  });
}

async function capture(page: Page, only: number | null): Promise<Dump> {
  return page.evaluate(([only, INTERACTIVE]) => {
    const SKIP = new Set(["script", "style", "link", "meta", "title", "head", "noscript", "base"]);
    const label = (el: Element) => (el.namespaceURI === "http://www.w3.org/1999/xhtml" ? "" : "svg:") + el.localName;
    const sandbox = document.createElement("iframe");
    sandbox.style.cssText = "position:absolute;visibility:hidden";
    document.body.append(sandbox);
    const sdoc = sandbox.contentDocument!;
    const defaults: Dump["defaults"] = {};
    const read = (cs: CSSStyleDeclaration) => {
      const o: Record<string, string> = {};
      for (let i = 0; i < cs.length; i++) o[cs[i]!] = cs.getPropertyValue(cs[i]!);
      return o;
    };
    const defaultFor = (el: Element, name: string) => {
      if (!defaults[name]) {
        const fresh = sdoc.createElementNS(el.namespaceURI, el.localName);
        const host = el.namespaceURI === "http://www.w3.org/2000/svg" ? sdoc.createElementNS("http://www.w3.org/2000/svg", "svg") : sdoc.body;
        host.append(fresh);
        if (host !== sdoc.body) sdoc.body.append(host);
        defaults[name] = read(sandbox.contentWindow!.getComputedStyle(fresh));
      }
      return defaults[name]!;
    };
    const nodes: Dump["nodes"] = {};
    const pathOf = (el: Element) => {
      const parts: string[] = [];
      for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) {
        const same = n.parentElement ? [...n.parentElement.children].filter((c) => label(c) === label(n!)) : [n];
        parts.unshift(`${label(n)}[${same.indexOf(n) + 1}]`);
      }
      return ["html", ...parts].join(">");
    };
    const visit = (el: Element, path: string) => {
      const name = label(el);
      const def = defaultFor(el, name);
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
    const walk = (el: Element, path: string) => {
      if (SKIP.has(el.localName)) return;
      visit(el, path);
      const seen: Record<string, number> = {};
      for (const c of el.children) {
        if (SKIP.has(c.localName)) continue;
        const l = label(c);
        seen[l] = (seen[l] ?? 0) + 1;
        walk(c, `${path}>${l}[${seen[l]}]`);
      }
    };
    if (only === null) walk(document.documentElement, "html");
    else {
      const targets = [...document.querySelectorAll(INTERACTIVE)].filter((e) => e.getClientRects().length > 0);
      const el = targets[only];
      if (el) visit(el, pathOf(el));
    }
    sandbox.remove();
    return { defaults, nodes };
  }, [only, INTERACTIVE] as const);
}

const interactiveCount = (page: Page) =>
  page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length > 0).length, INTERACTIVE);

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
      await page.getByRole("button", { name: "More actions for Delete me" }).click();
      await page.getByRole("menuitem", { name: "Delete" }).click();
      await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
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
  test.setTimeout(600_000);
  const out: Record<string, Dump> = {};
  for (const [profile, opts] of Object.entries(PROFILES)) {
    for (const [name, setup] of STATES) {
      const context = await browser.newContext({ ...opts, reducedMotion: "reduce", baseURL: "http://localhost:8839" });
      const page = await context.newPage();
      await page.clock.setFixedTime(FIXED_TIME);
      await setup(page);
      await settle(page);
      const key = `${profile}/${name}`;
      out[key] = await capture(page, null);

      const fine = await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches);
      const count = await interactiveCount(page);
      for (let i = 0; i < count; i++) {
        const box = await page.evaluate(
          ([i, sel]) => {
            const r = [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length > 0)[i]?.getBoundingClientRect();
            return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
          },
          [i, INTERACTIVE] as const,
        );
        if (fine && box) {
          await page.mouse.move(box.x, box.y);
          await settle(page);
          const hovered = await capture(page, i);
          for (const [p, v] of Object.entries(hovered.nodes)) out[key]!.nodes[`${p}@hover`] = v;
          await page.mouse.move(0, 0);
          await settle(page);
        }
        await page.keyboard.press("Shift");
        await page.evaluate(
          ([i, sel]) => {
            const el = [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length > 0)[i];
            if (el instanceof HTMLElement) el.focus();
          },
          [i, INTERACTIVE] as const,
        );
        await settle(page);
        const focused = await capture(page, i);
        for (const [p, v] of Object.entries(focused.nodes)) out[key]!.nodes[`${p}@focus`] = v;
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      }
      await context.close();
    }
  }
  mkdirSync(dirname(OUT), { recursive: true });
  const json = JSON.stringify(out);
  writeFileSync(OUT, OUT.endsWith(".gz") ? gzipSync(json, { level: 9 }) : json);
});
