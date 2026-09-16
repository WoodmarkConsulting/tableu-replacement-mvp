-- Dashboard: drillTest
-- Chart: ECU Faults by Country (drill source)
-- Data: Count of ECU fault records grouped by ISO alpha-2 country code
-- Shape: MapModule region rows { kind, regionCode, value, label }

SELECT
  'region' AS kind,
  UPPER(codelandiso1366_2) AS regionCode,
  CAST(COUNT(*) AS INT) AS value,
  MAX(country_name_germ) AS label
FROM westeurope_extollo_2026007fielddatadev75cd75.`2018001_xd_td_sofa_dev`.t_xd_td_diag_ecu_fault
WHERE
  LENGTH(codelandiso1366_2) = 2
  AND (COALESCE(:ecu_fault_nm, '') = '' OR ecu_fault_nm = :ecu_fault_nm)
GROUP BY UPPER(codelandiso1366_2)
