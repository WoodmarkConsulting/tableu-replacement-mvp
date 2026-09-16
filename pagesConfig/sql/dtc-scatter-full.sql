SELECT
  CAST(OdometerRead AS DOUBLE) AS x,
  CAST(FrequencyCount AS DOUBLE) AS y,
  CAST(DTCDataId AS DOUBLE) AS id,
  CAST(IsActive AS INT) AS color
FROM westeurope_extollo_platform_rd_eu_rdppe_non_customer_int_adbv.`2021024_sofa_gold_dev`.lsb_partitioned_dtcdata_2021024_sofa_gold
WHERE OdometerRead IS NOT NULL
  AND FrequencyCount IS NOT NULL
  AND DTCDataId IS NOT NULL
