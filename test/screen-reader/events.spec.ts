import { expect, test } from "./voiceover.ts";

test("an event row announces the column name with each value", async ({ page, request, voiceOver }) => {
  const meta = (await (await request.get("/api/meta")).json()) as { ingestToken: string };
  const sent = await request.post(`/plex?token=${meta.ingestToken}`, {
    data: {
      event: "media.play",
      Account: { title: "matt" },
      Metadata: { type: "movie", title: "The Matrix", year: 1999, librarySectionTitle: "Movies" },
    },
  });
  expect(sent.ok()).toBe(true);

  await page.goto("/events");
  const row = page.locator(".ev-summary").first();
  await expect(row).toBeVisible();
  await voiceOver.navigateToWebContent();

  await voiceOver.capture(() => row.focus(), { capture: true });

  const log = (await voiceOver.spokenPhraseLog()).join(" ");
  for (const label of ["Time:", "Event:", "User:", "Title:", "Library:", "Sent to:"]) {
    expect(log).toContain(label);
  }
});
