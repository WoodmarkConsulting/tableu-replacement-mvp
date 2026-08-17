import { execFile } from "node:child_process";
import { promisify } from "node:util";
import config from "./config";
import { ANSI_COLORS } from "../utils";

const execFileAsync = promisify(execFile);

const { CLI_PROFILE, DATABRICKS_CLI_PATH } = config;

type CurrentUser = {
  userName?: string;
  displayName?: string;
};

function normalizeWorkspaceUrl(workspaceUrl: string): string {
  try {
    return new URL(workspaceUrl).origin;
  } catch {
    throw new Error(`Invalid workspace URL: ${workspaceUrl}`);
  }
}

export async function verifyDatabricksConnection(
  workspaceUrl: string,
): Promise<boolean> {
  const expectedWorkspaceHost = normalizeWorkspaceUrl(workspaceUrl);

  console.info("Verifying Databricks connection...");

  // Verify that the configured profile points to the expected workspace.
  let authDescription: string;

  try {
    const { stderr, stdout } = await execFileAsync(
      DATABRICKS_CLI_PATH,
      ["auth", "describe", "--profile", CLI_PROFILE],
      {
        encoding: "utf8",
      },
    );

    if (stderr) {
      throw new Error(`Error while describing auth profile: ${stderr}`);
    }

    if (stdout.includes("Unable to authenticat")) {
      throw new Error(`Error while describing auth profile: ${stdout}`);
    }

    authDescription = stdout;
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        `${ANSI_COLORS.RED}Error: Failed to describe the Databricks profile "${CLI_PROFILE}".${ANSI_COLORS.RESET}`,
      );
      console.error(`Details: ${error.message}`);
    } else {
      console.error(
        `${ANSI_COLORS.RED}Error: An unknown error occurred while describing the Databricks profile "${CLI_PROFILE}".${ANSI_COLORS.RESET}`,
      );
    }

    return false;
  }

  const hostMatch = authDescription.match(/^Host:\s*(.+)$/m);

  if (!hostMatch) {
    console.error(
      `${ANSI_COLORS.RED}Error: Could not determine the workspace host from the Databricks profile.${ANSI_COLORS.RESET}`,
    );

    return false;
  }

  const configuredWorkspaceHost = normalizeWorkspaceUrl(hostMatch[1].trim());

  if (configuredWorkspaceHost !== expectedWorkspaceHost) {
    console.error(
      `${ANSI_COLORS.RED}Error: The Databricks profile points to a different workspace.${ANSI_COLORS.RESET}`,
    );

    console.error(`Expected: ${expectedWorkspaceHost}`);
    console.error(`Found:    ${configuredWorkspaceHost}`);

    return false;
  }

  // Perform a real API request against the workspace.
  try {
    const { stdout } = await execFileAsync(
      DATABRICKS_CLI_PATH,
      ["current-user", "me", "--profile", CLI_PROFILE, "--output", "json"],
      {
        encoding: "utf8",
      },
    );

    const currentUser = JSON.parse(stdout) as CurrentUser;

    console.info(
      `${ANSI_COLORS.GREEN}Databricks connection verified successfully.${ANSI_COLORS.RESET}`,
    );

    console.info(`Workspace: ${configuredWorkspaceHost}`);

    if (currentUser.userName) {
      console.info(`User: ${currentUser.userName}`);
    }

    return true;
  } catch {
    console.error(
      `${ANSI_COLORS.RED}Error: The Databricks CLI could not access the workspace.${ANSI_COLORS.RESET}`,
    );

    return false;
  }
}

// Allow this file to also be executed directly.
if (process.argv[1]?.endsWith("verifyDatabricksConnection.ts")) {
  const workspaceUrl = process.argv[2];

  if (!workspaceUrl) {
    console.error(
      `${ANSI_COLORS.RED}Error: No Databricks workspace URL provided.${ANSI_COLORS.RESET}`,
    );

    process.exit(1);
  }

  verifyDatabricksConnection(workspaceUrl)
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);

      console.error(`${ANSI_COLORS.RED}Error: ${message}${ANSI_COLORS.RESET}`);

      process.exit(1);
    });
}
