import fs from "fs";
import pagesConfig from "@/pagesConfig";
import { validateRootDirectoryAndPagesConfig } from "./utils";

// This script generates new Next.js pages based on the configuration provided in the pagesConfig array. It creates a folder for each page and an index.tsx file with boilerplate code.
function generateNextPage() {
  pagesConfig.forEach((dashboard) => {
    const { dashboardName, dashboardConfigName } = dashboard;

    const pageFolderPath = `app/${dashboardName}`;
    const pageFilePath = `${pageFolderPath}/page.tsx`;
    const dashboardConfigPath = `pagesConfig/${dashboardConfigName}`;

    // Validate the root directory and pagesConfig before proceeding with folder and file creation
    validateRootDirectoryAndPagesConfig(dashboard, dashboardConfigPath);

    // Before creating the folder and file, check if they already exist. If they do, skip the creation and log a message to the console.
    if (fs.existsSync(pageFolderPath)) {
      console.log(
        `Folder for page "${dashboardName}" already exists. Skipping creation.`,
      );
      return;
    }

    // Create the folder for the page
    try {
      fs.mkdirSync(pageFolderPath, { recursive: true });
    } catch (error) {
      console.error(
        `Error creating folder for page "${dashboardName}":`,
        error,
      );
      return;
    }

    // read the dashboard configuration from the JSON file
    let dashboardConfig: TabsConfig[];
    try {
      const configContent = fs.readFileSync(dashboardConfigPath, "utf-8");
      dashboardConfig = JSON.parse(configContent);
    } catch (error) {
      console.error(
        `Error reading or parsing dashboard configuration "${dashboardConfigPath}":`,
        error,
      );
      return;
    }

    // collect all "components.module" values from the dashboardConfig to form the imports
    const imports = new Set<string>();
    dashboardConfig.forEach((tab) => {
      tab.rows.forEach((row) => {
        row.components.forEach((component) => {
          imports.add(component.module as unknown as string);
        });
      });
    });

    // Create the import statements for the modules used in the dashboardConfig
    const importStatements = Array.from(imports)
      .map(
        (moduleName) =>
          `import { ${moduleName} } from "@/modules/${moduleName}";`,
      )
      .join("\n");

    // Serialize the dashboardConfig to a string, replacing the "module" values with the actual module names (without quotes) for proper import usage in the generated page.
    const serializedConfig = JSON.stringify(dashboardConfig, null, 2).replace(
      /"module":\s*"([A-Za-z_$][A-Za-z0-9_$]*)"/g,
      '"module": $1',
    );

    // Create the index.tsx file with boilerplate code
    const boilerplateCode = `
        import React from "react";
        import ChartPageWrapper from "@/components/ChartPageWrapper";
        import { TapsWrapper } from "@/components/TapsWrapper";
        ${importStatements}

        export default function ${dashboardName}() {

          const tabsConfig: TabsConfig[] = ${serializedConfig};

          return (
            <ChartPageWrapper>
                <TapsWrapper tabsConfig={tabsConfig} />
              </ChartPageWrapper>
          );
        }
    `;

    try {
      fs.writeFileSync(pageFilePath, boilerplateCode.trim());
      console.log(`Page "${dashboardName}" created successfully.`);
    } catch (error) {
      console.error(`Error creating page "${dashboardName}":`, error);
    }
  });
}

// Call the function to generate the pages
generateNextPage();
