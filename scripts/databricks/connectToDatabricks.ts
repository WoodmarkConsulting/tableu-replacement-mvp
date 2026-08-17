import { execFileSync, spawn } from "node:child_process";
import config from "./config";
import { verifyDatabricksConnection } from "./verifyDatabricksConnection";
import { ANSI_COLORS } from "../utils";

const workspaceUrl = process.argv[2];

const { CLI_PROFILE, DATABRICKS_CLI_PATH } = config;

function printDatabricksCliVersion(): void {
  try {
    const version = execFileSync(DATABRICKS_CLI_PATH, ["-v"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();

    console.log(`Using ${version}\n`);
  } catch {
    console.error(
      `${ANSI_COLORS.RED}Error: Failed to execute the project-local Databricks CLI.${ANSI_COLORS.RESET}`,
    );
    console.error(`Expected CLI path: ${DATABRICKS_CLI_PATH}`);

    process.exit(1);
  }
}

printDatabricksCliVersion();

if (!workspaceUrl) {
  console.error(
    `${ANSI_COLORS.RED}Error: No Databricks workspace URL provided.${ANSI_COLORS.RESET}\n` +
      "Please open your Databricks workspace in the browser and copy the full URL from the address bar.\n" +
      "Example usage:\n" +
      "https://<your-workspace>.azuredatabricks.net",
  );

  process.exit(1);
}

let parsedUrl: URL;

try {
  parsedUrl = new URL(workspaceUrl);
} catch {
  console.error(
    `${ANSI_COLORS.RED}Error: Invalid URL provided.${ANSI_COLORS.RESET}\n` +
      "Please ensure you copy the full URL from your Databricks workspace browser address bar.\n" +
      "Example usage:\n" +
      "https://<your-workspace>.azuredatabricks.net",
  );

  process.exit(1);
}

if (parsedUrl.protocol !== "https:") {
  console.error(
    `${ANSI_COLORS.RED}Error: The provided URL must use HTTPS.${ANSI_COLORS.RESET}\n` +
      "Please ensure you copy the full URL from your Databricks workspace browser address bar.\n" +
      "Example usage:\n" +
      "https://<your-workspace>.azuredatabricks.net",
  );

  process.exit(1);
}

const hostname = parsedUrl.hostname.toLowerCase();

const isDatabricksWorkspaceDomain =
  hostname.endsWith(".azuredatabricks.net") ||
  hostname.endsWith(".cloud.databricks.com") ||
  hostname.endsWith(".gcp.databricks.com");

if (!isDatabricksWorkspaceDomain) {
  console.error(
    `${ANSI_COLORS.RED}Error: The provided URL does not look like a Databricks workspace URL.${ANSI_COLORS.RESET}\n` +
      "Please open your workspace in Databricks and copy the URL directly from the browser address bar.",
  );

  process.exit(1);
}

if (hostname.startsWith("accounts.")) {
  console.error(
    `${ANSI_COLORS.RED}Error: You provided a Databricks account URL, not a workspace URL.${ANSI_COLORS.RESET}\n` +
      "Please open the target workspace first and then copy its URL from the browser address bar.",
  );

  process.exit(1);
}

// Users may paste any page inside the workspace.
// Only the workspace origin is required for authentication.
const workspaceHost = parsedUrl.origin;

const databricksAuthProcess = spawn(
  DATABRICKS_CLI_PATH,
  ["auth", "login", "--host", workspaceHost, "--profile", CLI_PROFILE],
  {
    stdio: "inherit",
  },
);

databricksAuthProcess.on("error", (error) => {
  console.error(
    `${ANSI_COLORS.RED}Error: Failed to start the Databricks CLI: ${error.message}${ANSI_COLORS.RESET}`,
  );

  process.exit(1);
});

databricksAuthProcess.on("exit", async (code) => {
  if (code !== 0) {
    console.error(
      `${ANSI_COLORS.RED}Error: Databricks authentication failed.${ANSI_COLORS.RESET}`,
    );

    process.exit(code ?? 1);
  }

  console.log();

  const connectionIsValid = await verifyDatabricksConnection(workspaceHost);

  process.exit(connectionIsValid ? 0 : 1);
});
