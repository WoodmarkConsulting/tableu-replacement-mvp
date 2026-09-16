-- Dashboard: Barchart Test with live data
-- Chart: Count Errors per ECU
-- Data: Number of ECU fault records grouped by ECU name (top 15)
-- Shape: BarChartModule rows { category: string, values: [count] }

SELECT
  ecu_nm AS category,
  array(CAST(COUNT(*) AS DOUBLE)) AS `values`
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_diag_ecu_fault
WHERE ecu_nm IS NOT NULL
  AND (:from IS NULL OR diag_start_dt >= CAST(:from AS DATE))
  AND (:to IS NULL OR diag_start_dt <= CAST(:to AS DATE))
  AND (:country IS NULL OR array_contains(split(:country, ','), country_name_germ))
  AND (
    :min_age IS NULL
    OR ezl_dt <= add_months(current_date(), -12 * CAST(:min_age AS INT))
  )
GROUP BY ecu_nm
ORDER BY COUNT(*) DESC
LIMIT 15
