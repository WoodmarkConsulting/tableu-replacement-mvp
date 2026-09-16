-- Dashboard: Production numbers
-- Tab: ZentraleFilterseite
-- Chart: sales countries (MapModule)
-- Data: Count of error records (row count) grouped by ISO alpha-2 sales country
-- Shape: MapModule region rows { kind: 'region', regionCode: string(2), value: number, label?: string }
-- Filters (all optional, multi-value comma-joined string when set):
--   :ms_nm, :ecu_fault_nm, :engine_md_cd, :trans_md_cd, :ms_cd, :md_cd, :ecu_nm
--   :prod_from, :prod_to (production date range, inclusive)
--   :diag_from, :diag_to (diagnosis date range, inclusive)

SELECT
  'region' AS kind,
  upper(codelandiso1366_2) AS regionCode,
  CAST(COUNT(*) AS DOUBLE) AS value,
  max(sales_area_nm) AS label
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_diag_ecu_fault
WHERE codelandiso1366_2 IS NOT NULL
  AND length(trim(codelandiso1366_2)) = 2
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
GROUP BY upper(codelandiso1366_2)
