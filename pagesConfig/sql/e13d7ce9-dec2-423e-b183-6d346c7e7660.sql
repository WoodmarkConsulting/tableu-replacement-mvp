-- Dashboard: Production numbers
-- Tab: Production Numbers 2
-- Chart: ECU Error Codes (TableModule)
-- Data: One row per ECU fault code with produced/error counts and error quota.
-- Shape: TableModule rows { id, parentId, values }
--   c_veh_produced = SUM(veh_total)
--   veh_w_error    = SUM(max_has_occurrence)
--   veh_error_quota = SUM(max_has_occurrence) / SUM(veh_total) (fraction, rendered as percent)
-- Filters (all optional, multi-value comma-joined string when set):
--   :ms_nm, :ecu_fault_nm, :engine_md_cd, :trans_md_cd, :ms_cd, :md_cd, :plant_letter_cd, :ecu_nm
--   Drilldown from "Zentrale Filterseite" (all optional, multi-value comma-joined string when set):
--   :drill_ecu_nm, :drill_engine_series, :drill_battery, :drill_trans_md_cd, :drill_ms_cd, :drill_country

WITH agg AS (
  SELECT
    ecu_fault_nm,
    SUM(veh_total) AS c_veh_produced,
    SUM(max_has_occurrence) AS veh_w_error,
    CASE WHEN SUM(veh_total) > 0 THEN SUM(max_has_occurrence) / SUM(veh_total) ELSE NULL END AS veh_error_quota
  FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_production_numbers
  WHERE ecu_fault_nm IS NOT NULL
    AND (COALESCE(CAST(:ms_nm AS STRING), '') = '' OR array_contains(split(CAST(:ms_nm AS STRING), ','), ms_nm))
    AND (COALESCE(CAST(:ecu_fault_nm AS STRING), '') = '' OR array_contains(split(CAST(:ecu_fault_nm AS STRING), ','), ecu_fault_nm))
    AND (COALESCE(CAST(:engine_md_cd AS STRING), '') = '' OR array_contains(split(CAST(:engine_md_cd AS STRING), ','), engine_md_cd))
    AND (COALESCE(CAST(:trans_md_cd AS STRING), '') = '' OR array_contains(split(CAST(:trans_md_cd AS STRING), ','), trans_md_cd))
    AND (COALESCE(CAST(:ms_cd AS STRING), '') = '' OR array_contains(split(CAST(:ms_cd AS STRING), ','), ms_cd))
    AND (COALESCE(CAST(:md_cd AS STRING), '') = '' OR array_contains(split(CAST(:md_cd AS STRING), ','), md_cd))
    AND (COALESCE(CAST(:plant_letter_cd AS STRING), '') = '' OR array_contains(split(CAST(:plant_letter_cd AS STRING), ','), plant_letter_cd))
    AND (COALESCE(CAST(:ecu_nm AS STRING), '') = '' OR array_contains(split(CAST(:ecu_nm AS STRING), ','), ecu_nm))
    AND (COALESCE(CAST(:drill_ecu_nm AS STRING), '') = '' OR array_contains(split(CAST(:drill_ecu_nm AS STRING), ','), ecu_nm))
    AND (COALESCE(CAST(:drill_engine_series AS STRING), '') = '' OR array_contains(split(CAST(:drill_engine_series AS STRING), ','), Motorbaureihe))
    AND (COALESCE(CAST(:drill_battery AS STRING), '') = '' OR array_contains(split(CAST(:drill_battery AS STRING), ','), Batterie))
    AND (COALESCE(CAST(:drill_trans_md_cd AS STRING), '') = '' OR array_contains(split(CAST(:drill_trans_md_cd AS STRING), ','), trans_md_cd))
    AND (COALESCE(CAST(:drill_ms_cd AS STRING), '') = '' OR array_contains(split(CAST(:drill_ms_cd AS STRING), ','), ms_cd))
    AND (COALESCE(CAST(:drill_country AS STRING), '') = '' OR array_contains(split(CAST(:drill_country AS STRING), ','), codelandiso1366_2))
  GROUP BY ecu_fault_nm
)
SELECT
  CAST(ROW_NUMBER() OVER (ORDER BY veh_w_error DESC) AS STRING) AS id,
  CAST(NULL AS STRING) AS parentId,
  to_json(
    named_struct(
      'ecu_fault_nm', ecu_fault_nm,
      'c_veh_produced', c_veh_produced,
      'veh_w_error', veh_w_error,
      'veh_error_quota', veh_error_quota
    )
  ) AS `values`
FROM agg
ORDER BY veh_w_error DESC
LIMIT 100
