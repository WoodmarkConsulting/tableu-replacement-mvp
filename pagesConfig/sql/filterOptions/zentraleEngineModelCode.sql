-- Motormodellcode Filter
-- Load distinct, non-empty engine model codes for the central dashboard filter.
SELECT DISTINCT 
    engine_md_cd AS value 
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.v_xd_diag_ecu_fault 
WHERE engine_md_cd IS NOT NULL 
AND trim(engine_md_cd) <> '' 
ORDER BY value;