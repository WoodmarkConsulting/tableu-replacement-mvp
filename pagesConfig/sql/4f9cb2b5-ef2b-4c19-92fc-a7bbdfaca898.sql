-- Dashboard: cudo-test
-- Chart: Analyse der Fahrzeuge über die Zeit
-- Data: Count of ECU fault records grouped by diagnosis date

WITH chart_input AS (
  SELECT from_json(
    CAST(:input AS STRING),
    'STRUCT<ecu_fault_nm: STRING, fin: STRING>'
  ) AS params
)

SELECT
  CAST(UNIX_DATE(diag_start_dt) * 1000 AS BIGINT) as x,
  array(COUNT(*)) as y
FROM westeurope_extollo_platform_rd_eu_rdpf_sandbox_adbv.`2018001_xd_td_sofa_dev`.t_xd_td_diag_ecu_fault
CROSS JOIN chart_input
WHERE 
  (COALESCE(chart_input.params.ecu_fault_nm, '') = '' OR ecu_fault_nm = chart_input.params.ecu_fault_nm)
  AND (COALESCE(chart_input.params.fin, '') = '' OR fin = chart_input.params.fin)
GROUP BY diag_start_dt
ORDER BY diag_start_dt ASC
