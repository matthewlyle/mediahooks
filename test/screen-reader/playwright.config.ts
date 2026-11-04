import { withGuidepup } from "@guidepup/playwright";
import { devices } from "@playwright/test";

const PORT = 8831;

export default withGuidepup({
  reportSlowTests: null,
  timeout: 90 * 1000,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: "webkit", use: { ...devices["Desktop Safari"] } }],
  webServer: {
    command: "bun src/server.ts",
    cwd: "../..",
    url: `http://localhost:${PORT}/healthz`,
    env: { AUTH: "off", PORT: String(PORT), DB_PATH: ":memory:" },
  },
});
