-- Options source for the "Land" (country) multiselect filter.
-- Returns distinct country names used in the ECU fault table.
-- Non-dependent: runs with no filter parameters.

SELECT DISTINCT country_name_germ AS value
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_diag_ecu_fault
WHERE country_name_germ IS NOT NULL
  AND trim(country_name_germ) <> ''
ORDER BY value
