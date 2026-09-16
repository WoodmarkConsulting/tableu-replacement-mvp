-- Dashboard: drillTest
-- Chart: Fault Trend for Selected Country (drill target)
-- Data: Count of ECU fault records over time, filtered by the drilled country
-- Shape: LineChartModule rows { x (unix ms), y: [count] }

SELECT
  CAST(UNIX_DATE(diag_start_dt) * 1000 AS BIGINT) AS x,
  array(COUNT(*)) AS y
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_diag_ecu_fault
WHERE
  (COALESCE(:country, '') = '' OR UPPER(codelandiso1366_2) = UPPER(:country))
  AND (COALESCE(:ecu_fault_nm, '') = '' OR ecu_fault_nm = :ecu_fault_nm)
GROUP BY diag_start_dt
ORDER BY diag_start_dt ASC
