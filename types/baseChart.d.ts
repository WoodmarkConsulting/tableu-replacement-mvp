type Enumerate<
  N extends number,
  Acc extends number[] = [],
> = Acc["length"] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc["length"]]>;

type Range1To100 = Exclude<Enumerate<101>, 0>;

type BaseChartProps = {
  height?: Range1To100;
};
