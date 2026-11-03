import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { voiceOver as guidepupVoiceOver } from "@guidepup/guidepup";
import { applicationIdMap } from "@guidepup/playwright/lib/applicationIdMap.js";
import { navigateVoiceOverToWebContent } from "@guidepup/playwright/lib/navigateVoiceOverToWebContent.js";
import { voiceOverTest, type VoiceOverPlaywright } from "@guidepup/playwright";
import { expect, type Page } from "@playwright/test";
import type { VoiceOver } from "@guidepup/guidepup";

export { expect };

const START_ATTEMPTS = 4;

async function startVoiceOver(voiceOver: VoiceOver, options: Parameters<VoiceOver["start"]>[0]) {
  await voiceOver.stop().catch(() => {});
  spawnSync("killall", ["VoiceOver"]);
  for (let attempt = 1; ; attempt++) {
    try {
      await voiceOver.start(options);
      return;
    } catch (error) {
      if (attempt === START_ATTEMPTS) throw error;
      await voiceOver.stop().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 5_000 * attempt));
    }
  }
}

export const test = voiceOverTest.extend<{ spokenPhraseLog: void }>({
  voiceOver: async ({ browserName, page, voiceOverStartOptions }, use) => {
    const voiceOver = guidepupVoiceOver as VoiceOverPlaywright;
    const applicationId = applicationIdMap[browserName];
    if (!applicationId) throw new Error(`Browser ${browserName} is not recognised.`);
    voiceOver.navigateToWebContent = async ({ capture } = {}) => {
      try {
        await navigateVoiceOverToWebContent({ voiceOver, page, applicationId, capture });
      } catch (error) {
        if (!/not running/i.test(String(error))) throw error;
        await startVoiceOver(voiceOver, voiceOverStartOptions);
        await navigateVoiceOverToWebContent({ voiceOver, page, applicationId, capture });
      }
    };
    try {
      await startVoiceOver(voiceOver, voiceOverStartOptions);
      await use(voiceOver);
    } finally {
      await voiceOver.stop().catch(() => {});
    }
  },
  spokenPhraseLog: [
    async ({ voiceOver }, use, testInfo) => {
      await use();
      const log = JSON.stringify(await voiceOver.spokenPhraseLog(), null, 2);
      await writeFile(testInfo.outputPath("spoken-phrase-log.json"), log);
    },
    { auto: true },
  ],
});

export async function expectAnnounced(page: Page, voiceOver: VoiceOver, action: () => Promise<unknown>, message: string): Promise<void> {
  await voiceOver.capture(action, { capture: true });
  await expect(page.locator(".toast-region")).toContainText(message);
  await expect
    .poll(
      async () => {
        await voiceOver.capture(async () => {}, { capture: true });
        return voiceOver.spokenPhraseLog();
      },
      { timeout: 15_000 },
    )
    .toContainEqual(expect.stringContaining(message));
  expect(await voiceOver.spokenPhraseLog()).not.toContainEqual(expect.stringContaining("Dismiss"));
}
