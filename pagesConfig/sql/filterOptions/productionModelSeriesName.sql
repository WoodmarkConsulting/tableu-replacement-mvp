-- Options source for the "Model Series" (ms_nm) multiselect filter.
-- Returns distinct model series names from the production numbers table.
-- Non-dependent: runs with no filter parameters.

SELECT DISTINCT ms_nm AS value
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_production_numbers
WHERE ms_nm IS NOT NULL
  AND trim(ms_nm) <> ''
ORDER BY value
