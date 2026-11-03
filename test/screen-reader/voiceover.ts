import { writeFile } from "node:fs/promises";
import type { VoiceOver } from "@guidepup/guidepup";
import { voiceOverTest } from "@guidepup/playwright";
import { expect } from "@playwright/test";

export { expect };

export const test = voiceOverTest.extend<{ spokenPhraseLog: void }>({
  spokenPhraseLog: [
    async ({ voiceOver }, use, testInfo) => {
      await use();
      const log = JSON.stringify(await voiceOver.spokenPhraseLog(), null, 2);
      await writeFile(testInfo.outputPath("spoken-phrase-log.json"), log);
    },
    { auto: true },
  ],
});

export async function expectAnnounced(voiceOver: VoiceOver, action: () => Promise<unknown>, message: string): Promise<void> {
  await voiceOver.capture(action, { capture: true });
  await expect
    .poll(
      async () => {
        await voiceOver.capture(async () => {}, { capture: true });
        return voiceOver.spokenPhraseLog();
      },
      { timeout: 15_000 },
    )
    .toContainEqual(expect.stringContaining(message));
}
