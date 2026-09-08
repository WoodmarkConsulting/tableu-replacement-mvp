import { execSync } from "node:child_process";

/**
 * Keeps package-lock.json in sync when dependencies are managed locally with pnpm.
 *
 * Local development uses pnpm to reduce disk usage by sharing packages through
 * pnpm's global store. Our VM/CI environment still installs dependencies with npm,
 * so it depends on package-lock.json being up to date.
 *
 * This script runs only after pnpm installs and updates package-lock.json without
 * creating npm node_modules or running npm lifecycle scripts.
 */
const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  process.exit(0);
}

execSync(
  "npm install --package-lock-only --ignore-scripts --no-audit --no-fund",
  {
    stdio: "inherit",
  },
);
