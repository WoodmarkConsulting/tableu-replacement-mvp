-- Dashboard: drillTest
-- Chart: Fault Trend for Selected Country (drill target)
-- Data: Count of ECU fault records over time, filtered by the drilled country
-- Shape: LineChartModule rows { x (unix ms), y: [count] }

WITH chart_input AS (
  SELECT from_json(
    CAST(:input AS STRING),
    'STRUCT<country: STRING, ecu_fault_nm: STRING>'
  ) AS params
)

SELECT
  CAST(UNIX_DATE(diag_start_dt) * 1000 AS BIGINT) AS x,
  array(COUNT(*)) AS y
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_diag_ecu_fault
CROSS JOIN chart_input
WHERE
  (COALESCE(chart_input.params.country, '') = '' OR UPPER(codelandiso1366_2) = UPPER(chart_input.params.country))
  AND (COALESCE(chart_input.params.ecu_fault_nm, '') = '' OR ecu_fault_nm = chart_input.params.ecu_fault_nm)
GROUP BY diag_start_dt
ORDER BY diag_start_dt ASC
