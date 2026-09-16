-- Dashboard: Production numbers
-- Tab: Production Numbers 2
-- Chart: Error Share by Drive Side (BarChartModule)
-- Data: Share of all errors attributed to left-hand-drive (true) vs non-LHD (false) vehicles.
-- Shape: BarChartModule rows { category: string, values: [percentage] }
--   percentage = SUM(max_has_occurrence) per lhd group / SUM(max_has_occurrence) overall * 100
--   The two bars sum to 100%.
-- Filters (all optional, multi-value comma-joined string when set):
--   :ms_nm, :ecu_fault_nm, :engine_md_cd, :trans_md_cd, :ms_cd, :md_cd, :plant_letter_cd, :ecu_nm
--   Drilldown from "Zentrale Filterseite" (all optional, multi-value comma-joined string when set):
--   :drill_ecu_nm, :drill_engine_series, :drill_battery, :drill_trans_md_cd, :drill_ms_cd, :drill_country

WITH filtered AS (
  SELECT
    lhd,
    max_has_occurrence
  FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_production_numbers
  WHERE lhd IS NOT NULL
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
),
totals AS (
  SELECT SUM(max_has_occurrence) AS total_errors FROM filtered
)
SELECT
  CASE WHEN f.lhd THEN 'Left-Hand Drive' ELSE 'Right-Hand Drive' END AS category,
  array(
    CASE
      WHEN t.total_errors > 0
        THEN CAST(SUM(f.max_has_occurrence) * 100.0 / t.total_errors AS DOUBLE)
      ELSE NULL
    END
  ) AS `values`
FROM filtered f
CROSS JOIN totals t
GROUP BY f.lhd, t.total_errors
ORDER BY f.lhd DESC
