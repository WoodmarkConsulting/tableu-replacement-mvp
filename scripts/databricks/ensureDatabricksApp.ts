import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";
import config from "./config";
import { ANSI_COLORS } from "../utils";

const execFileAsync = promisify(execFile);

const {
  CLI_PROFILE,
  DATABRICKS_CLI_PATH,
  DATABRICKS_APP_NAME: RAW_DATABRICKS_APP_NAME,
} = config;

const DATABRICKS_APP_NAME = RAW_DATABRICKS_APP_NAME.toLocaleLowerCase("en-US");

type DatabricksApp = {
  name: string;
  env_vars?: unknown[];
  [key: string]: unknown;
};

type DatabricksAppsListResponse = {
  apps?: DatabricksApp[];
  next_page_token?: string;
};

type CliError = Error & {
  stdout?: string;
  stderr?: string;
  code?: number | string;
};

const CACHE_DIRECTORY = path.resolve(process.cwd(), ".cache", "databricks");

const ENV_CACHE_FILE = path.join(
  CACHE_DIRECTORY,
  `${DATABRICKS_APP_NAME}-env.json`,
);

const APP_GET_RETRY_COUNT = 20;
const APP_GET_RETRY_DELAY_MS = 1_000;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getCliErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cliError = error as CliError;

  return cliError.stderr?.trim() || cliError.stdout?.trim() || cliError.message;
}

async function runDatabricksJson<T>(args: string[]): Promise<T> {
  const { stdout } = await execFileAsync(
    DATABRICKS_CLI_PATH,
    [...args, "--profile", CLI_PROFILE, "--output", "json"],
    {
      encoding: "utf8",
    },
  );

  if (!stdout.trim()) {
    throw new Error(
      `Databricks CLI returned no JSON output for command: ${args.join(" ")}`,
    );
  }

  return JSON.parse(stdout) as T;
}

async function runDatabricksCommand(args: string[]): Promise<void> {
  await execFileAsync(
    DATABRICKS_CLI_PATH,
    [...args, "--profile", CLI_PROFILE],
    {
      encoding: "utf8",
    },
  );
}

async function getApp(): Promise<DatabricksApp> {
  return runDatabricksJson<DatabricksApp>(["apps", "get", DATABRICKS_APP_NAME]);
}

async function findAppInList(): Promise<DatabricksApp | null> {
  let pageToken: string | undefined;

  do {
    const args = ["apps", "list", "--page-size", "100"];

    if (pageToken) {
      args.push("--page-token", pageToken);
    }

    const response = await runDatabricksJson<DatabricksAppsListResponse>(args);

    const app = response.apps?.find(
      (currentApp) => currentApp.name === DATABRICKS_APP_NAME,
    );

    if (app) {
      return app;
    }

    pageToken = response.next_page_token || undefined;
  } while (pageToken);

  return null;
}

async function checkAppExists(): Promise<DatabricksApp | null> {
  try {
    return await getApp();
  } catch (getError) {
    // A failed direct lookup does not automatically mean
    // that the app does not exist.
    //
    // Use the app list as a second check before deciding
    // that the app is missing.

    let listedApp: DatabricksApp | null;

    try {
      listedApp = await findAppInList();
    } catch (listError) {
      throw new Error(
        "Failed to check Databricks apps.\n\n" +
          `Direct app lookup error:\n${getCliErrorMessage(getError)}\n\n` +
          `App list error:\n${getCliErrorMessage(listError)}`,
      );
    }

    if (listedApp) {
      throw new Error(
        `Databricks app "${DATABRICKS_APP_NAME}" exists, ` +
          "but its details could not be retrieved.\n\n" +
          getCliErrorMessage(getError),
      );
    }

    return null;
  }
}

async function askToCreateApp(): Promise<boolean> {
  const readline = createInterface({
    input,
    output,
  });

  try {
    while (true) {
      const answer = (
        await readline.question(
          `Databricks app "${DATABRICKS_APP_NAME}" does not exist. Create it? [yes/no]: `,
        )
      )
        .trim()
        .toLowerCase();

      if (answer === "yes" || answer === "y") {
        return true;
      }

      if (answer === "no" || answer === "n") {
        return false;
      }

      console.log(
        `${ANSI_COLORS.YELLOW}Please enter "yes" or "no".${ANSI_COLORS.RESET}`,
      );
    }
  } finally {
    readline.close();
  }
}

async function createApp(): Promise<void> {
  console.log(`Creating Databricks app "${DATABRICKS_APP_NAME}"...`);

  await runDatabricksCommand([
    "apps",
    "create",
    DATABRICKS_APP_NAME,
    "--no-compute",
    "--no-wait",
  ]);
}

async function waitForApp(): Promise<DatabricksApp> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= APP_GET_RETRY_COUNT; attempt++) {
    try {
      return await getApp();
    } catch (error) {
      lastError = error;

      if (attempt < APP_GET_RETRY_COUNT) {
        await sleep(APP_GET_RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    `Databricks app "${DATABRICKS_APP_NAME}" was created, ` +
      "but could not be retrieved afterwards.\n\n" +
      getCliErrorMessage(lastError),
  );
}

async function cacheEnvironmentVariables(app: DatabricksApp): Promise<void> {
  await mkdir(CACHE_DIRECTORY, {
    recursive: true,
  });

  const cacheData = {
    app_name: app.name,
    cached_at: new Date().toISOString(),
    env_vars: app.env_vars ?? [],
  };

  await writeFile(ENV_CACHE_FILE, JSON.stringify(cacheData, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });

  console.log(
    `${ANSI_COLORS.GREEN}Environment variables cached successfully.${ANSI_COLORS.RESET}`,
  );

  console.log(`Cache file: ${ENV_CACHE_FILE}`);
}

async function main(): Promise<void> {
  console.log(`Checking for Databricks app "${DATABRICKS_APP_NAME}"...`);

  let app: DatabricksApp | null;

  try {
    app = await checkAppExists();
  } catch (error) {
    console.error(
      `${ANSI_COLORS.RED}Error: Failed to determine whether the Databricks app exists.${ANSI_COLORS.RESET}`,
    );

    console.error(getCliErrorMessage(error));

    process.exit(1);
  }

  if (app) {
    console.log(
      `${ANSI_COLORS.GREEN}Databricks app "${DATABRICKS_APP_NAME}" already exists.${ANSI_COLORS.RESET}`,
    );

    try {
      await cacheEnvironmentVariables(app);
    } catch (error) {
      console.error(
        `${ANSI_COLORS.RED}Error: Failed to cache Databricks app environment variables.${ANSI_COLORS.RESET}`,
      );

      console.error(getCliErrorMessage(error));

      process.exit(1);
    }

    return;
  }

  const shouldCreateApp = await askToCreateApp();

  if (!shouldCreateApp) {
    console.log("App creation cancelled. No changes were made.");

    return;
  }

  try {
    await createApp();

    console.log(
      `${ANSI_COLORS.GREEN}Databricks app creation request completed successfully.${ANSI_COLORS.RESET}`,
    );

    console.log("Waiting for the app to become available...");

    const createdApp = await waitForApp();

    console.log(
      `${ANSI_COLORS.GREEN}Databricks app "${DATABRICKS_APP_NAME}" is available.${ANSI_COLORS.RESET}`,
    );

    await cacheEnvironmentVariables(createdApp);
  } catch (error) {
    console.error(
      `${ANSI_COLORS.RED}Error: Failed to create or retrieve the Databricks app.${ANSI_COLORS.RESET}`,
    );

    console.error(getCliErrorMessage(error));

    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(`${ANSI_COLORS.RED}Unexpected error.${ANSI_COLORS.RESET}`);

  console.error(getCliErrorMessage(error));

  process.exit(1);
});
