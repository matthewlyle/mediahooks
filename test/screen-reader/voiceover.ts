import { writeFile } from "node:fs/promises";
import { voiceOverTest } from "@guidepup/playwright";

export { expect } from "@playwright/test";

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
