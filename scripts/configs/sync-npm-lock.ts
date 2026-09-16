// Syncs package-lock.json after pnpm installs because deployment still uses npm.
import { execSync } from "node:child_process";
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
