-- Options source for the "Fehlercode" (ecu_fault_nm) select filter.
-- Returns distinct fault codes from the production numbers table.
-- Non-dependent: runs with no filter parameters.

SELECT DISTINCT ecu_fault_nm AS value
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_production_numbers
WHERE ecu_fault_nm IS NOT NULL
  AND trim(ecu_fault_nm) <> ''
ORDER BY value
