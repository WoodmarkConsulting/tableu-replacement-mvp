// Generates dashboard pages from declarative configs so page implementation stays config-driven.
import fs from "fs";
import { validateDashboardConfig } from "../../lib/validateDashboardConfig";
import { validateRootDirectoryAndPagesConfig } from "../utils";

const generatedDashboardsDir = "app/Dashboards";

const createPageConfiguration = (
  configTemplate: string,
  dashboardConfig: DashboardConfig,
) => {
  const tabsConfig = dashboardConfig.tabs;
  const INITIAL_TAB = dashboardConfig.tabs[0]?.trigger ?? "";

  const dashboardConfigSections = configTemplate.split(
    "---- Dashboard Configuration Template ----",
  );
  const trimmedConfigSections = dashboardConfigSections[1]
    .replaceAll("\n", "")
    .trim()
    .split(";");

  const tabsConfigUpdateStatement = trimmedConfigSections[0].replace(
    "__TABS_CONFIG__",
    `${JSON.stringify(tabsConfig, null, 2)}`,
  );

  const dashboardConfigUpdateStatement = trimmedConfigSections[1].replace(
    "__DASHBOARD_CONFIG__",
    `${JSON.stringify(dashboardConfig, null, 2)}`,
  );

  const INITIAL_TAB_UPDATE_STATEMENT = trimmedConfigSections[2].replace(
    "__INITIAL_TAB__",
    `${JSON.stringify(INITIAL_TAB)}`,
  );

  const CONFIG_STATEMENTS = `
    ${tabsConfigUpdateStatement}
    ${dashboardConfigUpdateStatement}
    ${INITIAL_TAB_UPDATE_STATEMENT}
  `;

  return CONFIG_STATEMENTS;
};

const readTemplatesAndGeneratePage = (dashboardConfig: DashboardConfig) => {
  const pageTemplatePath = "app/DEV/template/page.template.tsx";
  const configTemplatePath = "app/DEV/template/dashboardConfig.ts";

  if (!fs.existsSync(pageTemplatePath) || !fs.existsSync(configTemplatePath)) {
    throw new Error("Template files are missing.");
  }

  const pageTemplate = fs
    .readFileSync(pageTemplatePath, "utf-8")
    .split("---- Page Template ----")[1];
  const configTemplate = fs.readFileSync(configTemplatePath, "utf-8");

  const configStatements = createPageConfiguration(
    configTemplate,
    dashboardConfig,
  );

  return { pageTemplate, configStatements };
};

const readPagesConfig = () => {
  const pagesConfigPath = "pagesConfig/pages.json";

  if (!fs.existsSync(pagesConfigPath)) {
    return [] as PagesConfig[];
  }

  const content = fs.readFileSync(pagesConfigPath, "utf-8");

  return JSON.parse(content) as PagesConfig[];
};

// Parses a "-d <config>" flag that forces regeneration of a single dashboard.
function parseDashboardArg(argv: string[]): string | undefined {
  const flagIndex = argv.findIndex(
    (arg) => arg === "-d" || arg === "--dashboard",
  );

  if (flagIndex === -1) {
    return undefined;
  }

  const value = argv[flagIndex + 1];

  if (!value || value.startsWith("-")) {
    throw new Error(
      'The "-d" flag requires a dashboard config file name, e.g. "-d productionNumbers.json".',
    );
  }

  return value;
}

// Matches a "-d" value against a dashboard by config file name (extension optional).
function matchesDashboard(dashboard: PagesConfig, target: string): boolean {
  const normalize = (value: string) => value.replace(/\.[^.]+$/, "");
  const normalizedTarget = normalize(target);

  return (
    dashboard.dashboardConfigName === target ||
    normalize(dashboard.dashboardConfigName) === normalizedTarget ||
    dashboard.dashboardName === target ||
    normalize(dashboard.dashboardName) === normalizedTarget
  );
}

function generatePageForDashboard(dashboard: PagesConfig, force: boolean) {
  const { dashboardName, dashboardConfigName } = dashboard;

  const pageFolderPath = `${generatedDashboardsDir}/${dashboardName}`;
  const pageFilePath = `${pageFolderPath}/page.tsx`;
  const pageConfigPath = `${pageFolderPath}/dashboardConfig.ts`;
  const dashboardConfigPath = `pagesConfig/${dashboardConfigName}`;

  // Validate the configuration before creating anything.
  validateRootDirectoryAndPagesConfig(dashboard, dashboardConfigPath);

  const pageAlreadyExists = fs.existsSync(pageFolderPath);

  // Never modify or delete an already existing page directory unless forced.
  if (pageAlreadyExists && !force) {
    console.info(
      `Folder for page "${dashboardName}" already exists. Skipping creation.`,
    );
    return;
  }

  let pageCreatedSuccessfully = false;

  try {
    // Create the page directory (idempotent when regenerating).
    fs.mkdirSync(pageFolderPath, {
      recursive: true,
    });

    // Read and parse the dashboard configuration.
    const configContent = fs.readFileSync(dashboardConfigPath, "utf-8");

    const dashboardConfig = JSON.parse(configContent) as DashboardConfig;
    validateDashboardConfig(dashboardConfig);

    // Generate the Next.js page along with its configuration.
    const { pageTemplate, configStatements } =
      readTemplatesAndGeneratePage(dashboardConfig);

    fs.writeFileSync(pageFilePath, pageTemplate.trim());
    fs.writeFileSync(pageConfigPath, configStatements.trim());

    pageCreatedSuccessfully = true;

    console.info(
      `Page "${dashboardName}" ${pageAlreadyExists ? "regenerated" : "created"} successfully.`,
    );
  } catch (error) {
    console.error(`Failed to create page "${dashboardName}":`, error);
  } finally {
    // Remove a freshly created directory if anything failed after it was created.
    if (
      !pageCreatedSuccessfully &&
      !pageAlreadyExists &&
      fs.existsSync(pageFolderPath)
    ) {
      try {
        fs.rmSync(pageFolderPath, {
          recursive: true,
          force: true,
        });

        console.info(`Removed incomplete page directory "${pageFolderPath}".`);
      } catch (cleanupError) {
        console.error(
          `Failed to remove incomplete page directory "${pageFolderPath}":`,
          cleanupError,
        );
      }
    }
  }
}

function generateNextPage() {
  const pagesConfig = readPagesConfig();
  const dashboardArg = parseDashboardArg(process.argv.slice(2));

  if (dashboardArg) {
    const target = pagesConfig.find((dashboard) =>
      matchesDashboard(dashboard, dashboardArg),
    );

    if (!target) {
      throw new Error(`No dashboard in pages.json matches "${dashboardArg}".`);
    }

    // Force regeneration for the explicitly requested dashboard.
    generatePageForDashboard(target, true);
    return;
  }

  pagesConfig.forEach((dashboard) => {
    generatePageForDashboard(dashboard, false);
  });
}

generateNextPage();
