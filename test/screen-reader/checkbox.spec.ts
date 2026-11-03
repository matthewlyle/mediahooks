import { expect, test } from "./voiceover.ts";

test("the poster checkbox announces its label, state and hint", async ({ page, request, voiceOver }) => {
  const created = await request.post("/api/webhooks", {
    data: { name: "Poster hook", url: "http://127.0.0.1:9/hook", events: ["media.play"], attachPoster: true },
  });
  expect(created.ok()).toBe(true);
  const { id } = (await created.json()) as { id: number };

  await page.goto(`/webhooks/${id}/edit`);
  const box = page.getByRole("checkbox", { name: "Attach poster" });
  await expect(box).toBeChecked();
  await voiceOver.navigateToWebContent();

  await voiceOver.capture(() => box.focus(), { capture: true });

  const log = (await voiceOver.spokenPhraseLog()).join(" ");
  expect(log).toContain("Attach poster");
  expect(log).toContain("sent as a file, Discord's format");
});
