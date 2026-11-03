import { defineConfig, devices } from "@playwright/test";

const PORT = 8839;
const SIGNED_OUT_PORT = 8840;

export default defineConfig({
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, actionTimeout: 5_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "bun src/server.ts",
      cwd: "../..",
      url: `http://localhost:${PORT}/healthz`,
      reuseExistingServer: false,
      env: { AUTH: "off", PORT: String(PORT), DB_PATH: ":memory:" },
    },
    {
      command: "bun src/server.ts",
      cwd: "../..",
      url: `http://localhost:${SIGNED_OUT_PORT}/healthz`,
      reuseExistingServer: false,
      env: { PORT: String(SIGNED_OUT_PORT), DB_PATH: ":memory:" },
    },
  ],
});
