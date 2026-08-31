type FilterConfig = import("./baseChart").FilterConfig;

type PagesConfig = {
  dashboardName: string;
  dashboardConfigName: string;
  globalFilters: FilterConfig[] | [];
};
// Example
// [
//   {
//     "dashboardName": "DacoDa",
//     "dashboardConfigName": "dacodaPageConfig.json"
//   }
// ]
