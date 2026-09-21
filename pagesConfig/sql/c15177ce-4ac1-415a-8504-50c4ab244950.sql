-- Dashboard: Connection Acceptance
-- Tab: Detail
-- Chart: Details Fahrzeugreihe (TableModule)
-- Data: Produced vehicles per vehicle series / ECU, filtered by the bar selection
--       (ecu_nm connection + control) and the sales country control.
-- Shape: TableModule rows { id, parentId, values }
-- Filters (all optional):
--   ecu_nm (multiselect + connection, comma-joined STRING) -> ecu_nm
--   sales_country (multiselect, comma-joined STRING) -> sales_area_nm

WITH chart_input AS (
  SELECT from_json(
    CAST(:input AS STRING),
    'STRUCT<ecu_nm: STRING, sales_country: STRING>'
  ) AS params
)

SELECT
  CAST(
    ROW_NUMBER() OVER (ORDER BY ms_cd, ms_nm, ecu_nm) AS STRING
  ) AS id,
  CAST(NULL AS STRING) AS parentId,
  to_json(
    named_struct(
      'ms_cd', ms_cd,
      'ms_nm', ms_nm,
      'ecu_nm', ecu_nm,
      'sales_area_nm', sales_area_nm,
      'veh_total', SUM(veh_total)
    )
  ) AS `values`
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_production_numbers
CROSS JOIN chart_input
WHERE
  (
    COALESCE(chart_input.params.ecu_nm, '') = ''
    OR array_contains(split(chart_input.params.ecu_nm, ','), ecu_nm)
  )
  AND (
    COALESCE(chart_input.params.sales_country, '') = ''
    OR array_contains(split(chart_input.params.sales_country, ','), sales_area_nm)
  )
GROUP BY ms_cd, ms_nm, ecu_nm, sales_area_nm
ORDER BY ms_cd, ms_nm, ecu_nm
LIMIT 200
