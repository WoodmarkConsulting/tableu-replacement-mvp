/**
 * ATTENTION: This is a template file.
 * EDITS TO THIS FILE WILL AFFECT THE GENERATED DASHBOARDS.
 * This will be used to generate the DEV environment page for the dashboard.
 * Template page for the DEV environment. Renders the dashboard using the DashboardShell component.
 */

//---- Page Template ----

"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { dashboardConfig, INITIAL_TAB } from "./dashboardConfig";

const Report = () => {
  return <DashboardShell config={dashboardConfig} initialTab={INITIAL_TAB} />;
};

export default Report;
