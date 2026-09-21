import { expect, test, type Locator, type Page } from "@playwright/test";

import { CHART, mockWarehouse, type WarehouseMock } from "./warehouseMock";

const DASHBOARD_URL = "/Dashboards/ConnectionAcceptance";

// Chart ids are UUIDs, which are not valid CSS identifiers after `#`.
const chart = (page: Page, chartID: string): Locator =>
  page.locator(`[id="${chartID}"]`);

const activeFilters = (page: Page): Locator =>
  page.locator('[data-slot="active-filters"]');

const apply = async (page: Page) => {
  await page.getByRole("button", { name: "Anwenden" }).click();
};

const chooseOption = async (
  page: Page,
  dimensionId: string,
  optionLabel: string,
) => {
  await page.getByTestId(`filter-${dimensionId}`).getByRole("button").click();
  await page.getByRole("option", { name: optionLabel }).click();
  await page.keyboard.press("Escape");
};

// Recharts resolves the active category from a mouse-move before the click, so a
// bare click() never reaches the module's selection handler.
const selectBar = async (page: Page, index: number) => {
  const rect = chart(page, CHART.bar)
    .locator(".recharts-bar-rectangle")
    .nth(index);

  await rect.hover();
  await page.waitForTimeout(300);
  await rect.click();
};

const applyConnectionTo = async (page: Page, targetTitle: string) => {
  // The enhanced tooltip opens over the plot after a selection and would swallow
  // the right-click, so close it first.
  const tooltipClose = page.getByRole("button", { name: "Tooltip schließen" });
  if (await tooltipClose.isVisible()) {
    await tooltipClose.click();
  }

  await chart(page, CHART.bar)
    .locator(".recharts-bar-rectangle")
    .first()
    .click({ button: "right" });

  const submenu = page.getByRole("menuitem", {
    name: "Verlinktes Diagramm filtern",
  });
  await expect(submenu).toBeEnabled();
  await submenu.click();

  const target = page.getByRole("menuitem", { name: targetTitle });
  await expect(target).toBeVisible();
  await target.click();
};

test.describe("Connection Acceptance dashboard", () => {
  let warehouse: WarehouseMock;

  test.beforeEach(async ({ page }) => {
    warehouse = await mockWarehouse(page);
    await page.goto(DASHBOARD_URL);
    await expect(
      page.getByRole("heading", { name: "Connection Acceptance" }),
    ).toBeVisible();
  });

  test("charts stay idle until Apply, then query with empty filters", async ({
    page,
  }) => {
    await expect(
      chart(page, CHART.bar).getByText("Bereit zum Abfragen"),
    ).toBeVisible();
    expect(warehouse.chartCalls).toEqual([]);

    await apply(page);

    await expect(
      chart(page, CHART.bar).locator(".recharts-bar-rectangle").first(),
    ).toBeVisible();
    expect(warehouse.lastFilters(CHART.bar)).toEqual({ sales_country: null });
    expect(warehouse.lastFilters(CHART.tableOverview)).toEqual({
      ecu_nm: null,
      sales_country: null,
    });
    // The second tab is not mounted, so it must not query yet.
    expect(warehouse.callsFor(CHART.tableDetail)).toEqual([]);
  });

  test("a dashboard control reaches every bound chart and shows a chip", async ({
    page,
  }) => {
    await apply(page);
    await chooseOption(page, "sales_country", "Deutschland");

    await expect(page.getByText("Nicht angewendete Änderungen")).toBeVisible();

    await apply(page);

    await expect
      .poll(() => warehouse.lastFilters(CHART.bar)?.sales_country)
      .toBe("Deutschland");
    await expect
      .poll(() => warehouse.lastFilters(CHART.tableOverview)?.sales_country)
      .toBe("Deutschland");
    await expect(activeFilters(page)).toContainText("Verkaufsland");
  });

  test("an auto connection filters its cross-tab target", async ({ page }) => {
    await apply(page);
    await expect(
      chart(page, CHART.bar).locator(".recharts-bar-rectangle").first(),
    ).toBeVisible();

    await selectBar(page, 0);

    await expect.poll(() => warehouse.tooltipCalls.length).toBeGreaterThan(0);
    expect(warehouse.tooltipCalls[0].chartID).toBe(CHART.bar);
    // One batched request carries the whole selection.
    expect(warehouse.tooltipCalls[0].dataPoints).toHaveLength(1);

    // The manual target on this tab must not move yet.
    expect(warehouse.lastFilters(CHART.tableOverview)?.ecu_nm).toBeNull();

    await page.getByRole("tab", { name: "Detail" }).click();

    await expect
      .poll(() => warehouse.lastFilters(CHART.tableDetail)?.ecu_nm)
      .toBe("ECU-Alpha");
    await expect(activeFilters(page)).toContainText("via Auswahl");
  });

  test("returning to the source tab keeps the applied connection filter", async ({
    page,
  }) => {
    await apply(page);
    await expect(
      chart(page, CHART.bar).locator(".recharts-bar-rectangle").first(),
    ).toBeVisible();

    await selectBar(page, 0);
    await expect.poll(() => warehouse.tooltipCalls.length).toBeGreaterThan(0);

    await page.getByRole("tab", { name: "Detail" }).click();
    await expect
      .poll(() => warehouse.lastFilters(CHART.tableDetail)?.ecu_nm)
      .toBe("ECU-Alpha");

    // Remounting the source chart must not discard what its selection applied.
    await page.getByRole("tab", { name: "Übersicht" }).click();
    await page.getByRole("tab", { name: "Detail" }).click();

    await expect
      .poll(() => warehouse.lastFilters(CHART.tableDetail)?.ecu_nm)
      .toBe("ECU-Alpha");
    await expect(activeFilters(page)).toContainText("via Auswahl");
  });

  test("one batched tooltip request carries the whole selection", async ({
    page,
  }) => {
    await apply(page);
    await expect(
      chart(page, CHART.bar).locator(".recharts-bar-rectangle").first(),
    ).toBeVisible();

    await selectBar(page, 0);

    await expect.poll(() => warehouse.tooltipCalls.length).toBeGreaterThan(0);
    expect(warehouse.tooltipCalls[0].chartID).toBe(CHART.bar);
    expect(warehouse.tooltipCalls[0].dataPoints).toHaveLength(1);
    expect(warehouse.tooltipCalls[0].dataPoints[0]).toMatchObject({
      category: "ECU-Alpha",
    });
  });

  test("a manual connection applies only from the context menu", async ({
    page,
  }) => {
    await apply(page);
    await expect(
      chart(page, CHART.bar).locator(".recharts-bar-rectangle").first(),
    ).toBeVisible();

    await selectBar(page, 1);
    await expect.poll(() => warehouse.tooltipCalls.length).toBeGreaterThan(0);

    const callsBefore = warehouse.callsFor(CHART.tableOverview).length;

    await applyConnectionTo(page, "Details Übersicht");

    await expect
      .poll(() => warehouse.callsFor(CHART.tableOverview).length)
      .toBeGreaterThan(callsBefore);
    expect(warehouse.lastFilters(CHART.tableOverview)?.ecu_nm).toBe("ECU-Beta");
  });

  test("a control and a selection that share no values render the conflict state", async ({
    page,
  }) => {
    await apply(page);
    await expect(
      chart(page, CHART.bar).locator(".recharts-bar-rectangle").first(),
    ).toBeVisible();

    await chooseOption(page, "ecu_nm", "ECU-Beta");
    await apply(page);

    // Select a different ECU and push it onto the same chart the control feeds.
    await selectBar(page, 0);
    await expect.poll(() => warehouse.tooltipCalls.length).toBeGreaterThan(0);

    await applyConnectionTo(page, "Details Übersicht");

    const conflicted = chart(page, CHART.tableOverview);
    const conflictTitle = conflicted.getByText("Widersprüchliche Filter", {
      exact: true,
    });
    await expect(conflictTitle).toBeVisible();

    const callsWhileImpossible = warehouse.callsFor(CHART.tableOverview).length;
    await page.waitForTimeout(500);
    expect(warehouse.callsFor(CHART.tableOverview)).toHaveLength(
      callsWhileImpossible,
    );

    await conflicted
      .getByRole("button", { name: "Widersprüchliche Filter entfernen" })
      .click();

    // Both conflicting contributions are dropped, so the chart falls back to its
    // already cached unfiltered result instead of issuing a new query.
    await expect(conflictTitle).toBeHidden();
    await expect(activeFilters(page)).toBeHidden();
  });

  test("Alle zurücksetzen returns to the idle state without querying", async ({
    page,
  }) => {
    await apply(page);
    await chooseOption(page, "sales_country", "Deutschland");
    await apply(page);
    await expect(activeFilters(page)).toContainText("Verkaufsland");

    const callsBefore = warehouse.chartCalls.length;

    await page.getByRole("button", { name: "Alle zurücksetzen" }).click();

    await expect(
      chart(page, CHART.bar).getByText("Bereit zum Abfragen"),
    ).toBeVisible();
    await page.waitForTimeout(500);
    expect(warehouse.chartCalls).toHaveLength(callsBefore);
  });
});
