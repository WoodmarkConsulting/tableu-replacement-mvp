-- Options source for the "Verkaufsland" (sales_country) multiselect filter.
-- Returns distinct sales areas from the production numbers table.
-- Non-dependent: runs with no filter parameters.

SELECT DISTINCT sales_area_nm AS value
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_production_numbers
WHERE sales_area_nm IS NOT NULL
  AND trim(sales_area_nm) <> ''
ORDER BY value
