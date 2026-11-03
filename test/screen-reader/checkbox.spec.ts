import { expect, test } from "./voiceover.ts";

let created: number | null = null;

test.afterEach(async ({ request }) => {
  if (created !== null) await request.delete(`/api/webhooks/${created}`);
  created = null;
});

test("the poster checkbox announces its label, state and hint", async ({ page, request, voiceOver }) => {
  const response = await request.post("/api/webhooks", {
    data: { name: "Poster hook", url: "http://127.0.0.1:9/hook", events: ["media.play"], attachPoster: true },
  });
  expect(response.ok()).toBe(true);
  const { id } = (await response.json()) as { id: number };
  created = id;

  await page.goto(`/webhooks/${id}/edit`);
  const box = page.getByRole("checkbox", { name: "Attach poster" });
  await expect(box).toBeChecked();
  await voiceOver.navigateToWebContent();

  await voiceOver.capture(() => box.focus(), { capture: true });

  const log = (await voiceOver.spokenPhraseLog()).join(" ");
  expect(log).toContain("Attach poster");
  expect(log).toContain("sent as a file, Discord's format");
});
