import type { APIRequestContext, Page } from "@playwright/test";
import type { VoiceOverPlaywright } from "@guidepup/playwright";
import { expect, test } from "./voiceover.ts";

async function createWebhook(request: APIRequestContext, name: string) {
  const created = await request.post("/api/webhooks", {
    data: { name, url: "http://127.0.0.1:9/hook", events: ["media.play"] },
  });
  expect(created.ok()).toBe(true);
  return ((await created.json()) as { id: number }).id;
}

async function expectHeadingAnnounced(page: Page, voiceOver: VoiceOverPlaywright, name: string) {
  await expect(page.getByRole("heading", { level: 2, name })).toBeFocused();
  await expect
    .poll(async () => (await voiceOver.spokenPhraseLog()).some((p) => p.includes(name) && /heading/i.test(p)), {
      timeout: 15_000,
    })
    .toBe(true);
}

test("opening a webhook announces the detail heading", async ({ page, request, voiceOver }) => {
  await createWebhook(request, "Living room alerts");
  await page.goto("/");
  const row = page.locator(".clickable-card-link").first();
  await expect(row).toBeVisible();
  await voiceOver.navigateToWebContent();
  await row.focus();

  await voiceOver.capture(() => row.press("Enter"), { capture: true });

  await expectHeadingAnnounced(page, voiceOver, "Living room alerts");
});

test("a nav link announces the destination heading", async ({ page, voiceOver }) => {
  await page.goto("/");
  const link = page.getByRole("banner").getByRole("link", { name: "Events" });
  await expect(link).toBeVisible();
  await voiceOver.navigateToWebContent();
  await link.focus();

  await voiceOver.capture(() => link.press("Enter"), { capture: true });

  await expectHeadingAnnounced(page, voiceOver, "Events");
});

test("Edit and Save announce the editor and detail headings", async ({ page, request, voiceOver }) => {
  const id = await createWebhook(request, "Kitchen alerts");
  await page.goto(`/webhooks/${id}`);
  const edit = page.getByRole("link", { name: "Edit" });
  await expect(edit).toBeVisible();
  await voiceOver.navigateToWebContent();
  await edit.focus();

  await voiceOver.capture(() => edit.press("Enter"), { capture: true });
  await expectHeadingAnnounced(page, voiceOver, "Edit Kitchen alerts");

  const save = page.getByRole("button", { name: "Save" });
  await save.focus();
  await voiceOver.clearSpokenPhraseLog();
  await voiceOver.capture(() => save.press("Enter"), { capture: true });
  await expectHeadingAnnounced(page, voiceOver, "Kitchen alerts");
});
