-- Dashboard: Production numbers
-- Tab: ZentraleFilterseite
-- Chart: sales countries (MapModule)
-- Data: Count of error records (row count) grouped by ISO alpha-2 sales country
-- Shape: MapModule region rows { kind: 'region', regionCode: string(2), value: number, label?: string }
-- Filters (all optional, multi-value comma-joined string when set):
--   :ms_nm, :ecu_fault_nm, :engine_md_cd, :trans_md_cd, :ms_cd, :md_cd, :ecu_nm
--   :prod_from, :prod_to (production date range, inclusive)
--   :diag_from, :diag_to (diagnosis date range, inclusive)

WITH chart_input AS (
  SELECT from_json(
    CAST(:input AS STRING),
    'STRUCT<ms_nm: STRING, ecu_fault_nm: STRING, engine_md_cd: STRING, trans_md_cd: STRING, ms_cd: STRING, md_cd: STRING, ecu_nm: STRING, prod_from: STRING, prod_to: STRING, diag_from: STRING, diag_to: STRING>'
  ) AS params
)

SELECT
  'region' AS kind,
  upper(codelandiso1366_2) AS regionCode,
  CAST(COUNT(*) AS DOUBLE) AS value,
  max(sales_area_nm) AS label
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_diag_ecu_fault
CROSS JOIN chart_input
WHERE codelandiso1366_2 IS NOT NULL
  AND length(trim(codelandiso1366_2)) = 2
  AND (COALESCE(chart_input.params.ms_nm, '') = '' OR array_contains(split(chart_input.params.ms_nm, ','), ms_nm))
  AND (COALESCE(chart_input.params.ecu_fault_nm, '') = '' OR array_contains(split(chart_input.params.ecu_fault_nm, ','), ecu_fault_nm))
  AND (COALESCE(chart_input.params.engine_md_cd, '') = '' OR array_contains(split(chart_input.params.engine_md_cd, ','), engine_md_cd))
  AND (COALESCE(chart_input.params.trans_md_cd, '') = '' OR array_contains(split(chart_input.params.trans_md_cd, ','), trans_md_cd))
  AND (COALESCE(chart_input.params.ms_cd, '') = '' OR array_contains(split(chart_input.params.ms_cd, ','), ms_cd))
  AND (COALESCE(chart_input.params.md_cd, '') = '' OR array_contains(split(chart_input.params.md_cd, ','), md_cd))
  AND (COALESCE(chart_input.params.ecu_nm, '') = '' OR array_contains(split(chart_input.params.ecu_nm, ','), ecu_nm))
  AND (chart_input.params.prod_from IS NULL OR prod_dt >= CAST(chart_input.params.prod_from AS DATE))
  AND (chart_input.params.prod_to IS NULL OR prod_dt <= CAST(chart_input.params.prod_to AS DATE))
  AND (chart_input.params.diag_from IS NULL OR diag_start_dt >= CAST(chart_input.params.diag_from AS DATE))
  AND (chart_input.params.diag_to IS NULL OR diag_start_dt <= CAST(chart_input.params.diag_to AS DATE))
GROUP BY upper(codelandiso1366_2)
