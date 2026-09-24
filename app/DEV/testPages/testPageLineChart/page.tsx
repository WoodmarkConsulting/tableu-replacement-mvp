"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { dashboardConfig, INITIAL_TAB } from "./dashboardConfig";

const Report = () => {
  return <DashboardShell config={dashboardConfig} initialTab={INITIAL_TAB} />;
};

export default Report;
