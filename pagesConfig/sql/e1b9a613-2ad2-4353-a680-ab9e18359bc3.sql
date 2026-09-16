-- Dashboard: Barchart Test with live data
-- Chart: Count Errors per ECU
-- Data: Number of ECU fault records grouped by ECU name (top 15)
-- Shape: BarChartModule rows { category: string, values: [count] }

WITH chart_input AS (
  SELECT from_json(
    CAST(:input AS STRING),
    'STRUCT<`from`: STRING, `to`: STRING, country: STRING, min_age: INT>'
  ) AS params
)

SELECT
  ecu_nm AS category,
  array(CAST(COUNT(*) AS DOUBLE)) AS `values`
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_diag_ecu_fault
CROSS JOIN chart_input
WHERE ecu_nm IS NOT NULL
  AND (chart_input.params.`from` IS NULL OR diag_start_dt >= CAST(chart_input.params.`from` AS DATE))
  AND (chart_input.params.`to` IS NULL OR diag_start_dt <= CAST(chart_input.params.`to` AS DATE))
  AND (chart_input.params.country IS NULL OR array_contains(split(chart_input.params.country, ','), country_name_germ))
  AND (
    chart_input.params.min_age IS NULL
    OR ezl_dt <= add_months(current_date(), -12 * chart_input.params.min_age)
  )
GROUP BY ecu_nm
ORDER BY COUNT(*) DESC
LIMIT 15
