import ChartPageWrapper from "@/components/ChartPageWrapper";
import { TapsWrapper } from "@/components/TapsWrapper";
import { LineChartModule } from "@/modules/LineChartModule";

export default function DacoDa() {
  const tabsConfig: TabsConfig[] = [
    {
      trigger: "Overview",
      rows: [
        {
          height: 12,
          components: [
            {
              module: LineChartModule,
              space: 3,
            },
            {
              module: LineChartModule,
              space: 6,
            },
          ],
        },
        {
          height: 50,
          components: [
            {
              module: LineChartModule,
              space: 12,
            },
          ],
        },
      ],
    },
    {
      trigger: "Analytics",
      rows: [
        {
          height: 12,
          components: [
            {
              module: LineChartModule,
              space: 3,
            },
            {
              module: LineChartModule,
              space: 6,
            },
          ],
        },
      ],
    },
    {
      trigger: "test special chars 1 !@#$%^&*()_+",
      rows: [
        {
          height: 100,
          components: [
            {
              module: LineChartModule,
              space: 3,
            },
          ],
        },
      ],
    },
  ];

  return (
    <ChartPageWrapper>
      <TapsWrapper tabsConfig={tabsConfig} />
    </ChartPageWrapper>
  );
}
