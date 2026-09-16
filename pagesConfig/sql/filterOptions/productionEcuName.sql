-- Options source for the "ECU" (ecu_nm) multiselect filter.
-- Returns distinct ECU names from the production numbers table.
-- Non-dependent: runs with no filter parameters.

SELECT DISTINCT ecu_nm AS value
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_production_numbers
WHERE ecu_nm IS NOT NULL
  AND trim(ecu_nm) <> ''
ORDER BY value
