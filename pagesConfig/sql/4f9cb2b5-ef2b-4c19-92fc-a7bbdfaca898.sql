-- Dashboard: cudo-test
-- Chart: Analyse der Fahrzeuge über die Zeit
-- Data: Count of ECU fault records grouped by diagnosis date

SELECT
  CAST(UNIX_DATE(diag_start_dt) * 1000 AS BIGINT) as x,
  array(COUNT(*)) as y
FROM westeurope_extollo_platform_rd_eu_rdpf_sandbox_adbv.`2018001_xd_td_sofa_dev`.t_xd_td_diag_ecu_fault
WHERE 
  (COALESCE(:ecu_fault_nm, '') = '' OR ecu_fault_nm = :ecu_fault_nm)
  AND (COALESCE(:fin, '') = '' OR fin = :fin)
GROUP BY diag_start_dt
ORDER BY diag_start_dt ASC
