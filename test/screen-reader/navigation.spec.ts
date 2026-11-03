import { expect, test } from "./voiceover.ts";

test("opening a webhook announces the detail heading", async ({ page, request, voiceOver }) => {
  const created = await request.post("/api/webhooks", {
    data: { name: "Living room alerts", url: "http://127.0.0.1:9/hook", events: ["media.play"] },
  });
  expect(created.ok()).toBe(true);

  await page.goto("/");
  const row = page.locator(".card-main").first();
  await expect(row).toBeVisible();
  await voiceOver.navigateToWebContent();
  await row.focus();

  await voiceOver.capture(() => row.press("Enter"), { capture: true });

  await expect(page.getByRole("heading", { level: 2, name: "Living room alerts" })).toBeFocused();
  expect(await voiceOver.spokenPhraseLog()).toContainEqual(expect.stringMatching(/Living room alerts.*heading/i));
});
