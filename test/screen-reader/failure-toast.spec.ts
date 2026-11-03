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
