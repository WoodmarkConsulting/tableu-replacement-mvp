// Generates dashboard pages from declarative configs so page implementation stays config-driven.
import fs from "fs";
import { validateRootDirectoryAndPagesConfig } from "../utils";

const generatedDashboardsDir = "app/Dashboards";

const readPagesConfig = () => {
  const pagesConfigPath = "pagesConfig/pages.json";

  if (!fs.existsSync(pagesConfigPath)) {
    return [] as PagesConfig[];
  }

  const content = fs.readFileSync(pagesConfigPath, "utf-8");

  return JSON.parse(content) as PagesConfig[];
};

export function buildPageBoilerplate(
  dashboardName: string,
  dashboardConfig: DashboardConfig,
): string {
  const tabsConfig = dashboardConfig.tabs;
  // React component names must be capitalized for the rules-of-hooks lint rule.
  const componentName =
    dashboardName.charAt(0).toUpperCase() + dashboardName.slice(1);

  return `
          "use client";

          import ChartPageWrapper from "@/components/ChartPageWrapper";
          import { useShallow } from "zustand/shallow";

          import { useLayoutEffect } from "react";
          import useFiltersStore from "@/stores/filterProvider";
          import { DashboardShell } from "@/components/DashboardShell";

          export default function ${componentName}() {
            const { initFilterStore, resetFilterStore } = useFiltersStore(
              useShallow((s) => ({
                initFilterStore: s.initFilterStore,
                resetFilterStore: s.resetFilterStore,
              })),
            );

            const tabsConfig = ${JSON.stringify(tabsConfig, null, 2)} as const satisfies TabsConfig[];
            const dashboardConfig: DashboardConfig<typeof tabsConfig> = {
              reportName: ${JSON.stringify(dashboardConfig.reportName)},
              filters: ${JSON.stringify(dashboardConfig.filters, null, 2)},
              tabs: tabsConfig,
              connections: ${JSON.stringify(dashboardConfig.connections, null, 2)},
              tabJumps: ${JSON.stringify(dashboardConfig.tabJumps, null, 2)},
            };


            useLayoutEffect(() => {
              initFilterStore({
                dimensions: dashboardConfig.filters,
                initialActiveTab: dashboardConfig.tabs[0]?.trigger ?? "",
              });

              return () => {
                resetFilterStore();
              };

              //eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);

            return (
              <ChartPageWrapper>
                <DashboardShell config={dashboardConfig} />
              </ChartPageWrapper>
            );
          }
        `.trim();
}

// Parses a "-d <config>" flag that forces regeneration of a single dashboard.
function parseDashboardArg(argv: string[]): string | undefined {
  const flagIndex = argv.findIndex((arg) => arg === "-d" || arg === "--dashboard");

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
  const dashboardConfigPath = `pagesConfig/${dashboardConfigName}`;

  // Validate the configuration before creating anything.
  validateRootDirectoryAndPagesConfig(dashboard, dashboardConfigPath);

  const pageAlreadyExists = fs.existsSync(pageFolderPath);

  // Never modify or delete an already existing page directory unless forced.
  if (pageAlreadyExists && !force) {
    console.log(
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

    // Generate the Next.js page.
    const boilerplateCode = buildPageBoilerplate(dashboardName, dashboardConfig);

    fs.writeFileSync(pageFilePath, boilerplateCode.trim());

    pageCreatedSuccessfully = true;

    console.log(
      `Page "${dashboardName}" ${pageAlreadyExists ? "regenerated" : "created"} successfully.`,
    );
  } catch (error) {
    console.error(`Failed to create page "${dashboardName}":`, error);
  } finally {
    // Remove a freshly created directory if anything failed after it was created.
    if (!pageCreatedSuccessfully && !pageAlreadyExists && fs.existsSync(pageFolderPath)) {
      try {
        fs.rmSync(pageFolderPath, {
          recursive: true,
          force: true,
        });

        console.log(`Removed incomplete page directory "${pageFolderPath}".`);
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
      throw new Error(
        `No dashboard in pages.json matches "${dashboardArg}".`,
      );
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
