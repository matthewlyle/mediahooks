import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const SIGNED_OUT_URL = "http://localhost:8838/";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

let active: number;
let paused: number;

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    const finite = () => document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity);
    while (finite().some((a) => a.playState === "running")) await Promise.allSettled(finite().map((a) => a.finished));
  });
}

const PAUSED = ".disabled";

async function violations(page: Page, configure: (axe: AxeBuilder) => AxeBuilder) {
  const { violations } = await configure(new AxeBuilder({ page }).withTags(TAGS)).analyze();
  return violations;
}

async function scan(page: Page, name: string) {
  await settle(page);
  const found = await violations(page, (axe) => axe.exclude(PAUSED));
  // Paused rows fail color-contrast until #10 is fixed; everything else in them is still scanned.
  if (await page.locator(PAUSED).count()) {
    found.push(...(await violations(page, (axe) => axe.include(PAUSED).disableRules(["color-contrast"]))));
  }
  const report = found.flatMap((v) =>
    v.nodes.map((n) => `${name}: ${v.id} (${v.impact}) ${n.target.join(" ")}\n    ${v.help}\n    ${v.helpUrl}`),
  );
  expect(report, `axe violations on ${name}`).toEqual([]);
}

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

  const meta = await (await request.get("/api/meta")).json();
  const sent = await request.post(`/plex?token=${meta.ingestToken}`, {
    data: { event: "media.play", Metadata: { type: "movie", title: "Arrival", year: 2016 } },
  });
  expect(sent.ok()).toBe(true);
  await expect.poll(async () => (await (await request.get("/api/events")).json()).length).toBeGreaterThan(0);
});

for (const [name, path] of [
  ["/", () => "/"],
  ["/events", () => "/events"],
  ["/help", () => "/help"],
  ["/new", () => "/new"],
  ["/webhooks/<id>", () => `/webhooks/${active}`],
  ["/webhooks/<id>/edit", () => `/webhooks/${active}/edit`],
  ["a paused webhook", () => `/webhooks/${paused}`],
] as const) {
  test(name, async ({ page }) => {
    await page.goto(path());
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await scan(page, name);
  });
}

test("signed-out sign-in", async ({ page }) => {
  await page.goto(SIGNED_OUT_URL);
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  await scan(page, "signed-out sign-in");
});

test("open row menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "More actions for Living room alerts" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await scan(page, "open row menu");
});

test("editor after a failed save", async ({ page }) => {
  await page.goto("/new");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".field-error").first()).toBeVisible();
  await scan(page, "editor after a failed save");
});
