import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { expect, expectAnnounced, test } from "./voiceover.ts";

const created: number[] = [];

test.afterEach(async ({ request }) => {
  for (const id of created.splice(0)) await request.delete(`/api/webhooks/${id}`);
});

async function createWebhook(request: APIRequestContext, label: string): Promise<string> {
  const name = `${label} ${randomUUID().slice(0, 8)}`;
  const res = await request.post("/api/webhooks", {
    data: { name, url: "http://127.0.0.1:9/hook", events: ["media.play"] },
  });
  expect(res.ok()).toBe(true);
  created.push(((await res.json()) as { id: number }).id);
  return name;
}

test("A failed toggle announces what failed and why", async ({ page, request, voiceOver }) => {
  const name = await createWebhook(request, "Flaky hook");
  await page.route("**/api/webhooks/*", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({ status: 500, json: { error: "database is locked" } })
      : route.continue(),
  );
  await page.goto("/");
  const toggle = page.getByRole("switch", { name: `Disable ${name}` });
  await expect(toggle).toBeVisible();
  await voiceOver.navigateToWebContent();

  await expectAnnounced(page, voiceOver, () => toggle.press("Space"), `Couldn't pause ${name}: database is locked`);
});

test("A failed duplicate announces what failed and why", async ({ page, request, voiceOver }) => {
  const name = await createWebhook(request, "Copy hook");
  await page.route("**/api/webhooks", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: { error: "database is locked" } })
      : route.continue(),
  );
  await page.goto("/");
  await page.getByRole("button", { name: `More actions for ${name}` }).press("Enter");
  const duplicate = page.getByRole("menuitem", { name: "Duplicate" });
  await expect(duplicate).toBeVisible();
  await voiceOver.navigateToWebContent();

  await expectAnnounced(page, voiceOver, () => duplicate.press("Enter"), `Couldn't duplicate ${name}: database is locked`);
});

test("A failed test send announces what failed", async ({ page, request, voiceOver }) => {
  const name = await createWebhook(request, "Test hook");
  await page.route("**/api/send-test", (route) =>
    route.fulfill({ json: { ok: false, status: 502, error: null, durationMs: 12 } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: `More actions for ${name}` }).press("Enter");
  const sendTest = page.getByRole("menuitem", { name: "Test" });
  await expect(sendTest).toBeVisible();
  await voiceOver.navigateToWebContent();

  await expectAnnounced(page, voiceOver, () => sendTest.press("Enter"), `Test to ${name} failed: 502`);
});

test("A failed token replace announces what failed and why", async ({ page, voiceOver }) => {
  await page.route("**/api/ingest-token", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: { error: "database is locked" } })
      : route.continue(),
  );
  await page.goto("/help");
  await page.getByRole("button", { name: "New token" }).press("Enter");
  const replace = page.getByRole("button", { name: "Replace token" });
  await expect(replace).toBeVisible();
  await voiceOver.navigateToWebContent();

  await expectAnnounced(
    page,
    voiceOver,
    () => replace.press("Enter"),
    "Couldn't replace the token, the old one still works: database is locked",
  );
  await expect(page.getByRole("button", { name: "New token" })).toBeFocused();
});
