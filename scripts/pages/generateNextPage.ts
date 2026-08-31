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

// This script generates new Next.js pages based on the configuration
// provided in the pagesConfig array.
function generateNextPage() {
  const pagesConfig = readPagesConfig();

  pagesConfig.forEach((dashboard) => {
    const { dashboardName, dashboardConfigName, globalFilters } = dashboard;

    const pageFolderPath = `${generatedDashboardsDir}/${dashboardName}`;
    const pageFilePath = `${pageFolderPath}/page.tsx`;
    const dashboardConfigPath = `pagesConfig/${dashboardConfigName}`;

    // Validate the configuration before creating anything.
    validateRootDirectoryAndPagesConfig(dashboard, dashboardConfigPath);

    // Never modify or delete an already existing page directory.
    if (fs.existsSync(pageFolderPath)) {
      console.log(
        `Folder for page "${dashboardName}" already exists. Skipping creation.`,
      );
      return;
    }

    let pageCreatedSuccessfully = false;

    try {
      // Create the page directory.
      fs.mkdirSync(pageFolderPath, {
        recursive: true,
      });

      // Read and parse the dashboard configuration.
      const configContent = fs.readFileSync(dashboardConfigPath, "utf-8");

      const dashboardConfig = JSON.parse(configContent) as DashboardConfig;

      // Generate the Next.js page.
      const boilerplateCode = `
          "use client";
          import useGlobalFilters from "@/context/globalFilter";
          import { useShallow } from "zustand/shallow";
          import { useLayoutEffect } from "react";

          import ChartPageWrapper from "@/components/ChartPageWrapper";
          import { TabsWrapper } from "@/components/TabsWrapper";
          import { TabsConfig } from "@/types/tabs";

          export default function ${dashboardName}() {
              const setGlobalFilterConfig = useGlobalFilters(
                useShallow((state) => state.setGlobalFilterConfig),
              );

            const tabsConfig: TabsConfig[] = ${JSON.stringify(dashboardConfig, null, 2)};
            const globalFilters: PagesConfig["globalFilters"] = ${JSON.stringify(globalFilters, null, 2)};

            useLayoutEffect(() => {
              setGlobalFilterConfig(globalFilters);

              //eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);

            return (
              <ChartPageWrapper>
                <TabsWrapper tabsConfig={tabsConfig} />
              </ChartPageWrapper>
            );
          }
        `;

      fs.writeFileSync(pageFilePath, boilerplateCode.trim());

      pageCreatedSuccessfully = true;

      console.log(`Page "${dashboardName}" created successfully.`);
    } catch (error) {
      console.error(`Failed to create page "${dashboardName}":`, error);
    } finally {
      // Remove the directory if anything failed after it was created.
      if (!pageCreatedSuccessfully && fs.existsSync(pageFolderPath)) {
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
  });
}

generateNextPage();
