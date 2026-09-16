-- Options source for the "Fahrzeugbaureihe" (ms_cd) select filter.
-- Returns distinct vehicle series codes from the production numbers table.
-- Non-dependent: runs with no filter parameters.

SELECT DISTINCT ms_cd AS value
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_production_numbers
WHERE ms_cd IS NOT NULL
  AND trim(ms_cd) <> ''
ORDER BY value
