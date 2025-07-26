import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  env: {
    ENABLE_CONSOLE_LOGS: "true",
    ENABLE_CONSOLE_ERRORS: "true",
  }
};

export default nextConfig;
