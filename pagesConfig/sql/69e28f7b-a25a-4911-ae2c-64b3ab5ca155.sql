-- Dashboard: Production numbers
-- Tab: Overview
-- Chart: Produktionsübersicht (TableModule)
-- Data: One row per production record with production/error counts and error quota.
-- Shape: TableModule rows { id, parentId, values }
--   vehicle_w_error = max_has_occurrence, c_veh_produced = veh_total
--   error_quota = max_has_occurrence / veh_total (fraction, rendered as percent)
-- Filters (all optional, multi-value comma-joined string when set):
--   :ms_nm, :ecu_fault_nm, :engine_md_cd, :trans_md_cd, :ms_cd, :md_cd, :plant_letter_cd, :ecu_nm

SELECT
  CAST(
    ROW_NUMBER() OVER (
      ORDER BY ms_nm, ecu_fault_nm, ecu_hw_partnumber_cd
    ) AS STRING
  ) AS id,
  CAST(NULL AS STRING) AS parentId,
  to_json(
    named_struct(
      'ms_nm', ms_nm,
      'ms_cd', ms_cd,
      'Motorbaureihe', Motorbaureihe,
      'plant_letter_cd', plant_letter_cd,
      'sales_area_nm', sales_area_nm,
      'trans_md_cd', trans_md_cd,
      'ecu_fault_nm', ecu_fault_nm,
      'ecu_foot_print_txt', ecu_foot_print_txt,
      'ecu_hw_partnumber_cd', ecu_hw_partnumber_cd,
      'lhd', lhd,
      'vehicle_w_error', max_has_occurrence,
      'c_veh_produced', veh_total,
      'error_quota',
        CASE
          WHEN veh_total > 0 THEN max_has_occurrence / veh_total
          ELSE NULL
        END
    )
  ) AS `values`
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_production_numbers
WHERE
  (COALESCE(CAST(:ms_nm AS STRING), '') = '' OR array_contains(split(CAST(:ms_nm AS STRING), ','), ms_nm))
  AND (COALESCE(CAST(:ecu_fault_nm AS STRING), '') = '' OR array_contains(split(CAST(:ecu_fault_nm AS STRING), ','), ecu_fault_nm))
  AND (COALESCE(CAST(:engine_md_cd AS STRING), '') = '' OR array_contains(split(CAST(:engine_md_cd AS STRING), ','), engine_md_cd))
  AND (COALESCE(CAST(:trans_md_cd AS STRING), '') = '' OR array_contains(split(CAST(:trans_md_cd AS STRING), ','), trans_md_cd))
  AND (COALESCE(CAST(:ms_cd AS STRING), '') = '' OR array_contains(split(CAST(:ms_cd AS STRING), ','), ms_cd))
  AND (COALESCE(CAST(:md_cd AS STRING), '') = '' OR array_contains(split(CAST(:md_cd AS STRING), ','), md_cd))
  AND (COALESCE(CAST(:plant_letter_cd AS STRING), '') = '' OR array_contains(split(CAST(:plant_letter_cd AS STRING), ','), plant_letter_cd))
  AND (COALESCE(CAST(:ecu_nm AS STRING), '') = '' OR array_contains(split(CAST(:ecu_nm AS STRING), ','), ecu_nm))
ORDER BY ms_nm, ecu_fault_nm, ecu_hw_partnumber_cd
LIMIT 100
