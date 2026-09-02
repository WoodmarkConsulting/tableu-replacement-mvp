type ChartStateProps = {
  height?: number;
  children: React.ReactNode;
};

/** Centers loading, empty, and error content within a chart-sized region. */
export default function ChartState({ height, children }: ChartStateProps) {
  return (
    <div
      className="flex w-full items-center justify-center"
      style={{
        height: `${height}svh`,
      }}>
      {children}
    </div>
  );
}
