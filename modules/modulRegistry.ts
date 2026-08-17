// AUTO-GENERATED FILE.
// DO NOT EDIT MANUALLY.
// Run the module registry generator to update this file.

import dynamic from "next/dynamic";

import LineChartModuleDataSchema from "@/modules/LineChartModule/chartDataSchema";

export type ModuleRegistryKeys = keyof typeof moduleRegistry;

export type ChartConfigs = LineChartConfig;

export const moduleRegistry = {
  "LineChartModule": {
    component: dynamic(() =>
      import("@/modules/LineChartModule").then(
        (loadedModule) => loadedModule.default,
      ),
    ),
    dataSchema: LineChartModuleDataSchema,
  },
} as const;

export type ModuleRegistryKey = keyof typeof moduleRegistry;
