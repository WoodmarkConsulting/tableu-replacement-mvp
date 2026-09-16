-- Dashboard: Production numbers
-- Tab: ZentraleFilterseite
-- Chart: TMC (BarChartModule)
-- Data: Count of error records (row count) grouped by transmission model code (top 15)
-- Shape: BarChartModule rows { category: string, values: [count] }
-- Filters (all optional, multi-value comma-joined string when set):
--   :ms_nm, :ecu_fault_nm, :engine_md_cd, :trans_md_cd, :ms_cd, :md_cd, :ecu_nm
--   :prod_from, :prod_to (production date range, inclusive)
--   :diag_from, :diag_to (diagnosis date range, inclusive)

SELECT
  trans_md_cd AS category,
  array(CAST(COUNT(*) AS DOUBLE)) AS `values`
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_diag_ecu_fault
WHERE trans_md_cd IS NOT NULL
  AND (COALESCE(CAST(:ms_nm AS STRING), '') = '' OR array_contains(split(CAST(:ms_nm AS STRING), ','), ms_nm))
  AND (COALESCE(CAST(:ecu_fault_nm AS STRING), '') = '' OR array_contains(split(CAST(:ecu_fault_nm AS STRING), ','), ecu_fault_nm))
  AND (COALESCE(CAST(:engine_md_cd AS STRING), '') = '' OR array_contains(split(CAST(:engine_md_cd AS STRING), ','), engine_md_cd))
  AND (COALESCE(CAST(:trans_md_cd AS STRING), '') = '' OR array_contains(split(CAST(:trans_md_cd AS STRING), ','), trans_md_cd))
  AND (COALESCE(CAST(:ms_cd AS STRING), '') = '' OR array_contains(split(CAST(:ms_cd AS STRING), ','), ms_cd))
  AND (COALESCE(CAST(:md_cd AS STRING), '') = '' OR array_contains(split(CAST(:md_cd AS STRING), ','), md_cd))
  AND (COALESCE(CAST(:ecu_nm AS STRING), '') = '' OR array_contains(split(CAST(:ecu_nm AS STRING), ','), ecu_nm))
  AND (:prod_from IS NULL OR prod_dt >= CAST(:prod_from AS DATE))
  AND (:prod_to IS NULL OR prod_dt <= CAST(:prod_to AS DATE))
  AND (:diag_from IS NULL OR diag_start_dt >= CAST(:diag_from AS DATE))
  AND (:diag_to IS NULL OR diag_start_dt <= CAST(:diag_to AS DATE))
GROUP BY trans_md_cd
ORDER BY COUNT(*) DESC
LIMIT 15
