-- Vehicle Model Code Filter
-- Load distinct, non-empty vehicle model codes for the central dashboard filter.
SELECT DISTINCT 
    md_cd AS value 
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.v_xd_diag_ecu_fault 
WHERE md_cd IS NOT NULL 
AND trim(md_cd) <> '' 
ORDER BY value;