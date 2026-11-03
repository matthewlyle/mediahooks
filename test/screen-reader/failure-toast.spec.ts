import { expect, test } from "./voiceover.ts";

test("A failed toggle announces what failed and why", async ({ page, request, voiceOver }) => {
  const created = await request.post("/api/webhooks", {
    data: { name: "Flaky hook", url: "http://127.0.0.1:9/hook", events: ["media.play"] },
  });
  expect(created.ok()).toBe(true);

  await page.route("**/api/webhooks/*", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({ status: 500, json: { error: "database is locked" } })
      : route.continue(),
  );
  await page.goto("/");
  const toggle = page.getByRole("switch", { name: "Disable Flaky hook" });
  await expect(toggle).toBeVisible();
  await voiceOver.navigateToWebContent();

  await voiceOver.capture(() => toggle.press("Space"), { capture: true });

  expect(await voiceOver.spokenPhraseLog()).toContainEqual(
    expect.stringContaining("Couldn't pause Flaky hook: database is locked"),
  );
});

test("A failed duplicate announces what failed and why", async ({ page, request, voiceOver }) => {
  const created = await request.post("/api/webhooks", {
    data: { name: "Copy hook", url: "http://127.0.0.1:9/hook", events: ["media.play"] },
  });
  expect(created.ok()).toBe(true);

  await page.route("**/api/webhooks", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: { error: "database is locked" } })
      : route.continue(),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "More actions for Copy hook" }).press("Enter");
  const duplicate = page.getByRole("menuitem", { name: "Duplicate" });
  await expect(duplicate).toBeVisible();
  await voiceOver.navigateToWebContent();

  await voiceOver.capture(() => duplicate.press("Enter"), { capture: true });

  expect(await voiceOver.spokenPhraseLog()).toContainEqual(
    expect.stringContaining("Couldn't duplicate Copy hook: database is locked"),
  );
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

  await voiceOver.capture(() => replace.press("Enter"), { capture: true });

  expect(await voiceOver.spokenPhraseLog()).toContainEqual(
    expect.stringContaining("Couldn't replace the token, the old one still works: database is locked"),
  );
});
