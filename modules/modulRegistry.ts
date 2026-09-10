// AUTO-GENERATED FILE.
// DO NOT EDIT MANUALLY.
// Run the module registry generator to update this file.

import dynamic from "next/dynamic";

import BarChartModuleDataSchema from "@/modules/BarChartModule/chartDataSchema";
import LineChartModuleDataSchema from "@/modules/LineChartModule/chartDataSchema";
import MapModuleDataSchema from "@/modules/MapModule/chartDataSchema";

export type ModuleRegistryKeys = keyof typeof moduleRegistry;

export type ChartConfigs = BarChartConfig | LineChartConfig | MapChartConfig;

export const moduleRegistry = {
  "BarChartModule": {
    component: dynamic(() =>
      import("@/modules/BarChartModule").then(
        (loadedModule) => loadedModule.default,
      ),
    ),
    dataSchema: BarChartModuleDataSchema,
  },
  "LineChartModule": {
    component: dynamic(() =>
      import("@/modules/LineChartModule").then(
        (loadedModule) => loadedModule.default,
      ),
    ),
    dataSchema: LineChartModuleDataSchema,
  },
  "MapModule": {
    component: dynamic(() =>
      import("@/modules/MapModule").then(
        (loadedModule) => loadedModule.default,
      ),
    ),
    dataSchema: MapModuleDataSchema,
  },
} as const;

export type ModuleRegistryKey = keyof typeof moduleRegistry;
