-- Transmission Model Code Filter
-- Load distinct, non-empty transmission model codes for the central dashboard filter.
SELECT DISTINCT 
    trans_md_cd AS value 
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.v_xd_diag_ecu_fault 
WHERE trans_md_cd IS NOT NULL 
AND trim(trans_md_cd) <> '' 
ORDER BY value;