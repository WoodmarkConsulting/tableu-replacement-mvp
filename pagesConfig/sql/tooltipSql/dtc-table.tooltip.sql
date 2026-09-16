SELECT
  CAST(unix_millis(CAST(DATE(dtc.LastUpdate) AS TIMESTAMP)) AS DOUBLE) AS LastUpdate,
  CAST(-1 AS INT) AS IsActive,
  date_format(DATE(dtc.LastUpdate), 'dd.MM.yyyy') AS datum,
  SUM(CASE WHEN dtc.IsActive = -1 THEN 1 ELSE 0 END) AS aktive_dtcs,
  SUM(CASE WHEN dtc.IsStored = -1 THEN 1 ELSE 0 END) AS gespeicherte_dtcs,
  COUNT(DISTINCT dtc.dtc_number) AS unterschiedliche_dtc_codes,
  COUNT(DISTINCT dtc.CarId) AS betroffene_fahrzeuge
FROM westeurope_extollo_platform_rd_eu_rdppe_non_customer_int_adbv.`2021024_sofa_gold_dev`.lsb_partitioned_dtcdata_2021024_sofa_gold AS dtc
WHERE array_contains(
  from_json(CAST(:x AS STRING), 'array<double>'),
  CAST(unix_millis(CAST(DATE(dtc.LastUpdate) AS TIMESTAMP)) AS DOUBLE)
)
GROUP BY DATE(dtc.LastUpdate)
ORDER BY DATE(dtc.LastUpdate);
