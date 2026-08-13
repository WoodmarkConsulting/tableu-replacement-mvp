import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const fillRow = (
  components: {
    module: React.ComponentType<BaseChartProps>;
    space: number;
  }[],
) => {
  const result = components.map((component) => ({
    ...component,
    effectiveSpace: component.space,
  }));

  const usedSpace = result.reduce((sum, component) => sum + component.space, 0);

  if (result.length > 0 && usedSpace < 12) {
    result[result.length - 1].effectiveSpace += 12 - usedSpace;
  }

  return result;
};

type Props = {
  tabsConfig: TabsConfig[];
};

export function TapsWrapper({ tabsConfig }: Props) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        {tabsConfig.map((tab) => (
          <TabsTrigger key={tab.trigger} value={tab.trigger.toLowerCase()}>
            {tab.trigger}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabsConfig.map((tab) => (
        <TabsContent key={tab.trigger} value={tab.trigger.toLowerCase()}>
          <div className="flex flex-col gap-4">
            {tab.rows.map((row, rowIndex) => {
              const components = fillRow(row.components);

              return (
                <div key={rowIndex} className="grid grid-cols-12 gap-4">
                  {components.map((component, index) => {
                    const Module = component.module;

                    return (
                      <div
                        key={index}
                        style={{
                          gridColumn: `span ${component.effectiveSpace} / span ${component.effectiveSpace}`,
                        }}>
                        <Module height={row.height} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
