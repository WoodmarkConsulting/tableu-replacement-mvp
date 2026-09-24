-- Fehlercode Filter
-- Load distinct, non-empty fault descriptions for the central dashboard filter.
SELECT DISTINCT 
    ecu_fault_desc AS value 
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.v_xd_diag_ecu_fault 
WHERE ecu_fault_desc IS NOT NULL 
AND trim(ecu_fault_desc) <> '' 
ORDER BY value;