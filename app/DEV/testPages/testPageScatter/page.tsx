"use client";

import { DashboardShell } from "@/components/DashboardShell";
import { dashboardConfig, INITIAL_TAB } from "./dashboardConfig";

export default function TestPageScatter() {
  return <DashboardShell config={dashboardConfig} initialTab={INITIAL_TAB} />;
}
