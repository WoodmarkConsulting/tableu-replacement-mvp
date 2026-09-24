-- Fahrzeugbaureihe Filter
-- Load distinct, non-empty vehicle series codes for the central dashboard filter.
SELECT DISTINCT 
    ms_cd AS value 
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.v_xd_diag_ecu_fault 
WHERE ms_cd IS NOT NULL 
AND trim(ms_cd) <> '' 
ORDER BY value;