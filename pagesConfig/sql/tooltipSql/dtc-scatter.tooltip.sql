WITH selected_ids AS (
  SELECT EXPLODE(
    FROM_JSON(CAST(:id AS STRING), 'array<double>')
  ) AS id
)

SELECT
  CAST(source.DTCDataId AS DOUBLE) AS id,
  date_format(DATE(source.LastUpdate), 'dd.MM.yyyy') AS datum,
  source.dtc_number AS dtc_number,
  source.CarName AS CarName,
  source.ECUName AS ECUName,
  source.SymptomName AS SymptomName,
  source.ErrorText AS ErrorText
FROM westeurope_extollo_platform_rd_eu_rdppe_non_customer_int_adbv.`2021024_sofa_gold_dev`.lsb_partitioned_dtcdata_2021024_sofa_gold AS source
INNER JOIN selected_ids
  ON CAST(source.DTCDataId AS DOUBLE) = selected_ids.id
ORDER BY source.DTCDataId
