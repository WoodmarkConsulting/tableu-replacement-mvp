-- Plant Filter
-- Load distinct, non-empty production plant codes for the central dashboard filter.
SELECT DISTINCT 
prod_plant_cd AS value 
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.v_xd_diag_ecu_fault 
WHERE prod_plant_cd IS NOT NULL 
AND trim(prod_plant_cd) <> '' 
ORDER BY value;