import { execSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";

/**
 * `pnpm e2e` runs the guest-only build. `pnpm e2e:auth` (E2E_SUPABASE=1) builds against the local
 * `supabase start` stack on another port and runs the `"requires": "supabase"` scenarios.
 */
const auth = !!process.env.E2E_SUPABASE;
const PORT = auth ? 3001 : 3000;
const baseURL = `http://localhost:${PORT}`;

function localSupabaseEnv(): Record<string, string> {
  const status = execSync("pnpm exec supabase status -o env", { cwd: "../..", encoding: "utf8" });
  const value = (name: string) => status.match(new RegExp(`^${name}="?([^"\\n]*)"?$`, "m"))?.[1] ?? "";
  return {
    NEXT_PUBLIC_SUPABASE_URL: value("API_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: value("PUBLISHABLE_KEY") || value("ANON_KEY"),
    E2E_MAILPIT_URL: value("MAILPIT_URL") || value("INBUCKET_URL"),
  };
}
// Config loads again in each worker; workers inherit the env the main process resolved.
process.env.E2E_SUPABASE_ENV ??= auth ? JSON.stringify(localSupabaseEnv()) : "{}";
const serverEnv = JSON.parse(process.env.E2E_SUPABASE_ENV) as Record<string, string>;
if (auth) process.env.E2E_MAILPIT_URL = serverEnv.E2E_MAILPIT_URL;

export default defineConfig({
  testDir: "./e2e",
  testMatch: auth ? "scenarios.spec.ts" : undefined,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: process.env.CI ? `pnpm build && pnpm start --port ${PORT}` : `pnpm dev --port ${PORT}`,
    env: serverEnv,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
