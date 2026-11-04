import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "./voiceover.ts";

let receiver: Server;
let release: () => void;
let released: Promise<void>;

test.beforeEach(() => {
  released = new Promise((resolve) => (release = resolve));
});

test.afterEach(() => release());

test.beforeAll(async () => {
  receiver = createServer((req, res) => {
    req.resume();
    void released.then(() => res.end("ok"));
  });
  receiver.listen(0, "127.0.0.1");
  await once(receiver, "listening");
});

test.afterAll(async () => {
  receiver.close();
  receiver.closeAllConnections();
  await once(receiver, "close");
});

test("Send test announces that it is sending", async ({ page, request, voiceOver }) => {
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

  const busy = expect(send).toHaveAttribute("aria-busy", "true", { timeout: 30_000 });
  await voiceOver.capture(() => send.press("Enter"), { capture: true });
  await busy;

  expect(await voiceOver.spokenPhraseLog()).toContainEqual(expect.stringContaining("Sending test…"));
});
