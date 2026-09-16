-- Options source for the "Motormodell-Code" (engine_md_cd) select filter.
-- Returns distinct engine model codes from the production numbers table.
-- Non-dependent: runs with no filter parameters.

SELECT DISTINCT engine_md_cd AS value
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_production_numbers
WHERE engine_md_cd IS NOT NULL
  AND trim(engine_md_cd) <> ''
ORDER BY value
