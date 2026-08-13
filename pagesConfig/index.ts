// This configuration is used to create a new Next.js Page with a boilerplate code. The configuration is an array of strings, where each string represents a page name. The page names are used to generate the corresponding TypeScript files in the pages directory.

export type PagesConfig = {
  dashboardName: string;
  dashboardConfigName: string;
};

const pagesConfig: PagesConfig[] = [
  {
    dashboardName: "DacoDa",
    dashboardConfigName: "dacodaPageConfig.json",
  },
];

export default pagesConfig;
