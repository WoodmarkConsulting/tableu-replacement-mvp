import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const config = (phase: string): NextConfig => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    // allow next.js to route to dev files and template files during development
    // not routeable in production
    pageExtensions: isDev
      ? [
          "dev.tsx",
          "dev.ts",
          "template.tsx",
          "template.ts",
          "template.js",
          "tsx",
          "ts",
          "jsx",
          "js",
        ]
      : ["tsx", "ts", "jsx", "js"],
  };
};

export default config;
