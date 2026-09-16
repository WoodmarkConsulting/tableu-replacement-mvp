WITH selected_rows AS (
  SELECT
    DATE(fleet_creation_date) AS fleet_day,
    user_id,
    fleet_name,
    car_id_list
  FROM westeurope_extollo_platform_rd_eu_rdppe_non_customer_int_adbv.`2021024_sofa_gold_dev`.fleet_definition_2021024_sofa_gold
  WHERE fleet_creation_date IS NOT NULL
    AND array_contains(
      from_json(CAST(:x AS STRING), 'array<double>'),
      CAST(unix_millis(CAST(DATE(fleet_creation_date) AS TIMESTAMP)) AS DOUBLE)
    )
),

daily_values AS (
  SELECT
    fleet_day,
    COUNT(DISTINCT user_id) AS active_users,
    COUNT(DISTINCT fleet_name) AS created_fleets
  FROM selected_rows
  GROUP BY fleet_day
),

connection_values AS (
  SELECT
    fleet_day,
    array_sort(collect_set(trim(raw_car_name))) AS CarName
  FROM selected_rows
  LATERAL VIEW explode(split(car_id_list, ',')) exploded AS raw_car_name
  WHERE car_id_list IS NOT NULL
    AND trim(raw_car_name) <> ''
  GROUP BY fleet_day
)

SELECT
  date_format(fleet_day, 'dd.MM.yyyy') AS datum,
  CAST(fleet_day AS STRING) AS fleet_creation_date,
  active_users AS aktive_nutzer,
  created_fleets AS erstellte_fleets,
  CarName
FROM daily_values
LEFT JOIN connection_values USING (fleet_day)
ORDER BY fleet_day;
