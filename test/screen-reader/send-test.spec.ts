import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "./voiceover.ts";

let receiver: Server;

test.beforeAll(async () => {
  receiver = createServer((req, res) => {
    req.resume();
    setTimeout(() => res.end("ok"), 5000);
  });
  receiver.listen(0, "127.0.0.1");
  await once(receiver, "listening");
});

test.afterAll(async () => {
  receiver.close();
  receiver.closeAllConnections();
  await once(receiver, "close");
});

test("Send test announces that it is sending or busy", async ({ page, request, voiceOver }) => {
  const { port } = receiver.address() as AddressInfo;
  const created = await request.post("/api/webhooks", {
    data: { name: "Slow receiver", url: `http://127.0.0.1:${port}/hook`, events: ["media.play"] },
  });
  expect(created.ok()).toBe(true);
  const { id } = (await created.json()) as { id: number };

  await page.goto(`/webhooks/${id}/edit`);
  const send = page.getByRole("button", { name: "Send test" });
  await expect(send).toBeVisible();
  await voiceOver.navigateToWebContent();

  await voiceOver.capture(() => send.press("Enter"), { capture: true });

  expect(await voiceOver.spokenPhraseLog()).toContainEqual(expect.stringMatching(/Sending test…|button busy/));
});
