-- Options source for the "Werk" (plant_letter_cd) select filter.
-- Returns distinct plant codes from the production numbers table.
-- Non-dependent: runs with no filter parameters.

SELECT DISTINCT plant_letter_cd AS value
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_production_numbers
WHERE plant_letter_cd IS NOT NULL
  AND trim(plant_letter_cd) <> ''
ORDER BY value
