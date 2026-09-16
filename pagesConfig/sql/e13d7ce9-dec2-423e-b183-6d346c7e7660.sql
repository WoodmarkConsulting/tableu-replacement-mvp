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

WITH chart_input AS (
  SELECT from_json(
    CAST(:input AS STRING),
    'STRUCT<ms_nm: STRING, ecu_fault_nm: STRING, engine_md_cd: STRING, trans_md_cd: STRING, ms_cd: STRING, md_cd: STRING, plant_letter_cd: STRING, ecu_nm: STRING, drill_ecu_nm: STRING, drill_engine_series: STRING, drill_battery: STRING, drill_trans_md_cd: STRING, drill_ms_cd: STRING, drill_country: STRING>'
  ) AS params
),
agg AS (
  SELECT
    ecu_fault_nm,
    SUM(veh_total) AS c_veh_produced,
    SUM(max_has_occurrence) AS veh_w_error,
    CASE WHEN SUM(veh_total) > 0 THEN SUM(max_has_occurrence) / SUM(veh_total) ELSE NULL END AS veh_error_quota
  FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_production_numbers
  CROSS JOIN chart_input
  WHERE ecu_fault_nm IS NOT NULL
    AND (COALESCE(chart_input.params.ms_nm, '') = '' OR array_contains(split(chart_input.params.ms_nm, ','), ms_nm))
    AND (COALESCE(chart_input.params.ecu_fault_nm, '') = '' OR array_contains(split(chart_input.params.ecu_fault_nm, ','), ecu_fault_nm))
    AND (COALESCE(chart_input.params.engine_md_cd, '') = '' OR array_contains(split(chart_input.params.engine_md_cd, ','), engine_md_cd))
    AND (COALESCE(chart_input.params.trans_md_cd, '') = '' OR array_contains(split(chart_input.params.trans_md_cd, ','), trans_md_cd))
    AND (COALESCE(chart_input.params.ms_cd, '') = '' OR array_contains(split(chart_input.params.ms_cd, ','), ms_cd))
    AND (COALESCE(chart_input.params.md_cd, '') = '' OR array_contains(split(chart_input.params.md_cd, ','), md_cd))
    AND (COALESCE(chart_input.params.plant_letter_cd, '') = '' OR array_contains(split(chart_input.params.plant_letter_cd, ','), plant_letter_cd))
    AND (COALESCE(chart_input.params.ecu_nm, '') = '' OR array_contains(split(chart_input.params.ecu_nm, ','), ecu_nm))
    AND (COALESCE(chart_input.params.drill_ecu_nm, '') = '' OR array_contains(split(chart_input.params.drill_ecu_nm, ','), ecu_nm))
    AND (COALESCE(chart_input.params.drill_engine_series, '') = '' OR array_contains(split(chart_input.params.drill_engine_series, ','), Motorbaureihe))
    AND (COALESCE(chart_input.params.drill_battery, '') = '' OR array_contains(split(chart_input.params.drill_battery, ','), Batterie))
    AND (COALESCE(chart_input.params.drill_trans_md_cd, '') = '' OR array_contains(split(chart_input.params.drill_trans_md_cd, ','), trans_md_cd))
    AND (COALESCE(chart_input.params.drill_ms_cd, '') = '' OR array_contains(split(chart_input.params.drill_ms_cd, ','), ms_cd))
    AND (COALESCE(chart_input.params.drill_country, '') = '' OR array_contains(split(chart_input.params.drill_country, ','), codelandiso1366_2))
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
