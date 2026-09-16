-- Dashboard: Production numbers
-- Tab: Production Numbers 2
-- Chart: Transmission Series (TableModule)
-- Data: One row per transmission series (trans_md_cd) with error quota and vehicle count.
-- Shape: TableModule rows { id, parentId, values }
--   error_quota = SUM(max_has_occurrence) / SUM(veh_total) (fraction, rendered as percent)
--   veh_count   = SUM(veh_total)
-- Filters (all optional, multi-value comma-joined string when set):
--   :ms_nm, :ecu_fault_nm, :engine_md_cd, :trans_md_cd, :ms_cd, :md_cd, :plant_letter_cd, :ecu_nm
--   Drilldown from "Zentrale Filterseite" (all optional, multi-value comma-joined string when set):
--   :drill_ecu_nm, :drill_engine_series, :drill_battery, :drill_trans_md_cd, :drill_ms_cd, :drill_country

WITH agg AS (
  SELECT
    trans_md_cd,
    CASE WHEN SUM(veh_total) > 0 THEN SUM(max_has_occurrence) / SUM(veh_total) ELSE NULL END AS error_quota,
    SUM(veh_total) AS veh_count
  FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_production_numbers
  WHERE trans_md_cd IS NOT NULL
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
  GROUP BY trans_md_cd
)
SELECT
  CAST(ROW_NUMBER() OVER (ORDER BY veh_count DESC) AS STRING) AS id,
  CAST(NULL AS STRING) AS parentId,
  to_json(
    named_struct(
      'trans_md_cd', trans_md_cd,
      'error_quota', error_quota,
      'veh_count', veh_count
    )
  ) AS `values`
FROM agg
ORDER BY veh_count DESC
LIMIT 100
