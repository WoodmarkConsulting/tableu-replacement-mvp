import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabsConfig } from "@/types/tabs";
import ChartWrapper from "../ChartWrapper";

/**
 * Fills the row with components and adjusts the last component's space if the total used space is less than 12.
 */
const fillRow = (components: TabsConfig["rows"][number]["components"]) => {
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
                    const {
                      effectiveSpace,

                      ...compConfig
                    } = component;

                    return (
                      <div
                        key={index}
                        style={{
                          gridColumn: `span ${effectiveSpace} / span ${effectiveSpace}`,
                        }}>
                        <ChartWrapper
                          {...compConfig}
                          height={row.height || 15}
                        />
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
