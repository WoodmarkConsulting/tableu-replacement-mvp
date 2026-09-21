-- Tooltip / connection source for "Produktion je ECU" (BarChartModule).
-- Batched: every selected bar arrives as a JSON array parameter.
--   :category -> ARRAY<STRING> (the selected ECU names)
-- Emits ECU as an atomic alias for outgoing chart connections, plus the vehicle
-- series present and the total production count for the selected ECUs.
-- Batch-union-safe: one independent result row per selected ECU.
WITH selected AS (
  SELECT DISTINCT ecu AS ecu_nm
  FROM (
    SELECT explode(from_json(CAST(:category AS STRING), 'array<string>')) AS ecu
  )
  WHERE ecu IS NOT NULL
)
SELECT
  p.ecu_nm AS `ECU`,
  concat_ws(', ', array_sort(collect_set(p.ms_cd))) AS `Fahrzeugreihe`,
  SUM(p.veh_total) AS `Produktionsanzahl`
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_production_numbers p
JOIN selected s
  ON p.ecu_nm = s.ecu_nm
GROUP BY p.ecu_nm
