// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

/**
 * ATTENTION:
 * -    ORDER MATTERS!
 * - "Dashboard Configuration Template" IS A KEY SIGNAL FOR THE SYSTEM
 *
 * "Dashboard Configuration Template" is used to filter and identify relevant dashboard configuration files.
 * Order of tabsConfig, dashboardConfig, and INITIAL_TAB matters.
 * If the order is incorrect, TypeScript type checking may fail and Dashboard generation may not work as expected.
 * If the Order must be changed, ensure the "/scripts/pages/generateNextPage.ts" script is updated accordingly.
 *
 */

//---- Dashboard Configuration Template ----

export const tabsConfig = __TABS_CONFIG__ as const satisfies TabsConfig[];

export const dashboardConfig: DashboardConfig<typeof tabsConfig> =
  __DASHBOARD_CONFIG__;

export const INITIAL_TAB: (typeof tabsConfig)[number]["trigger"] =
  __INITIAL_TAB__;
