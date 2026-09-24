-- Fahrzeugbaureihe chart:
-- Fahrzeugbaureihe: count errors records per ms_nm, ranked by error count.
-- Parse the dashboard filters from the single JSON input before querying the source view.
WITH chart_input AS (SELECT from_json(CAST(:input AS STRING), 'STRUCT<ms_cd: STRING, ecu_fault_desc: STRING, engine_md_cd: STRING, trans_md_cd: STRING, md_cd: STRING, plant_letter_cd: STRING, ecus: STRING, prod_from: STRING, prod_to: STRING, diag_from: STRING, diag_to: STRING, selection_ecu_nm: STRING, selection_engine_series: STRING, selection_battery: STRING, selection_trans_md_cd_4: STRING, selection_country: STRING, selection_ms_nm: STRING>') AS params)
-- Count error records per vehicle series and return the top 15 categories.
SELECT ms_nm AS category, array(CAST(COUNT(ecu_fault_nm) AS DOUBLE)) AS `values`
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.v_xd_diag_ecu_fault CROSS JOIN chart_input
WHERE ms_nm IS NOT NULL AND trim(ms_nm) <> ''
  AND (chart_input.params.ms_cd IS NULL OR array_contains(split(chart_input.params.ms_cd, ','), ms_cd)) AND (chart_input.params.ecu_fault_desc IS NULL OR array_contains(split(chart_input.params.ecu_fault_desc, ','), ecu_fault_desc)) AND (chart_input.params.engine_md_cd IS NULL OR array_contains(split(chart_input.params.engine_md_cd, ','), engine_md_cd)) AND (chart_input.params.trans_md_cd IS NULL OR array_contains(split(chart_input.params.trans_md_cd, ','), trans_md_cd)) AND (chart_input.params.md_cd IS NULL OR array_contains(split(chart_input.params.md_cd, ','), md_cd)) AND (chart_input.params.plant_letter_cd IS NULL OR array_contains(split(chart_input.params.plant_letter_cd, ','), prod_plant_cd)) AND (chart_input.params.ecus IS NULL OR array_contains(split(chart_input.params.ecus, ','), ecu_nm)) AND (chart_input.params.prod_from IS NULL OR prod_dt >= CAST(chart_input.params.prod_from AS DATE)) AND (chart_input.params.prod_to IS NULL OR prod_dt <= CAST(chart_input.params.prod_to AS DATE)) AND (chart_input.params.diag_from IS NULL OR diag_start_dt >= CAST(chart_input.params.diag_from AS DATE)) AND (chart_input.params.diag_to IS NULL OR diag_start_dt <= CAST(chart_input.params.diag_to AS DATE))
  AND (chart_input.params.selection_ecu_nm IS NULL OR array_contains(split(chart_input.params.selection_ecu_nm, ','), ecu_nm))
  AND (chart_input.params.selection_engine_series IS NULL OR array_contains(split(chart_input.params.selection_engine_series, ','), Motorbaureihe))
  AND (chart_input.params.selection_battery IS NULL OR array_contains(split(chart_input.params.selection_battery, ','), Batterie))
  AND (chart_input.params.selection_trans_md_cd_4 IS NULL OR array_contains(split(chart_input.params.selection_trans_md_cd_4, ','), trans_md_cd_4))
  AND (chart_input.params.selection_country IS NULL OR array_contains(split(chart_input.params.selection_country, ','), codelandiso1366_2))
  AND (chart_input.params.selection_ms_nm IS NULL OR array_contains(split(chart_input.params.selection_ms_nm, ','), ms_nm))
GROUP BY ms_nm ORDER BY COUNT(ecu_fault_nm) DESC LIMIT 15;
