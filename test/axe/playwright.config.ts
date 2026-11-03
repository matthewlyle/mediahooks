import { defineConfig, devices } from "@playwright/test";
import { freePorts } from "../free-ports";

const [PORT, SIGNED_OUT_PORT] = freePorts("MEDIAHOOKS_AXE_PORTS", 2);

export default defineConfig({
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, reducedMotion: "reduce" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "bun src/server.ts",
      cwd: "../..",
      url: `http://localhost:${PORT}/healthz`,
      env: { AUTH: "off", PORT: String(PORT), DB_PATH: ":memory:" },
    },
    {
      command: "bun src/server.ts",
      cwd: "../..",
      url: `http://localhost:${SIGNED_OUT_PORT}/healthz`,
      env: { PORT: String(SIGNED_OUT_PORT), DB_PATH: ":memory:" },
    },
  ],
});
