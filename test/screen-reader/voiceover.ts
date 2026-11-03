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
  const heard: string[] = [];
  let listening = true;
  const listen = (async () => {
    while (listening) {
      const phrase = await voiceOver.lastSpokenPhrase().catch(() => "");
      if (phrase && heard.at(-1) !== phrase) heard.push(phrase);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  })();
  try {
    await action();
    await expect.poll(() => heard, { timeout: 15_000 }).toContainEqual(expect.stringContaining(message));
  } finally {
    listening = false;
    await listen;
  }
}
