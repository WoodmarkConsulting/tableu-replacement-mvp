-- ECU Filter
-- Load distinct, non-empty ECU names for the central dashboard filter.
SELECT DISTINCT 
    ecu_nm AS value 
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.v_xd_diag_ecu_fault 
WHERE ecu_nm IS NOT NULL 
AND trim(ecu_nm) <> '' 
ORDER BY value;