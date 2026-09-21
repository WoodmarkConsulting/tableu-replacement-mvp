-- Dashboard: Connection Acceptance
-- Tab: Übersicht
-- Chart: Produktion je ECU (BarChartModule)
-- Data: Total produced vehicles (SUM veh_total) grouped by ECU (top 15).
-- Shape: BarChartModule rows { category: string, values: [count] }
-- Filters (all optional):
--   sales_country (multiselect, comma-joined STRING) -> sales_area_nm

WITH chart_input AS (
  SELECT from_json(
    CAST(:input AS STRING),
    'STRUCT<sales_country: STRING>'
  ) AS params
)

SELECT
  ecu_nm AS category,
  array(CAST(SUM(veh_total) AS DOUBLE)) AS `values`
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_production_numbers
CROSS JOIN chart_input
WHERE ecu_nm IS NOT NULL
  AND (
    COALESCE(chart_input.params.sales_country, '') = ''
    OR array_contains(split(chart_input.params.sales_country, ','), sales_area_nm)
  )
GROUP BY ecu_nm
ORDER BY SUM(veh_total) DESC
LIMIT 15
