import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["hudsonkit", "studio"],
  turbopack: {
    // SpeakEasy's own pnpm-lock.yaml sits two levels up; pin the root here
    // so Next does not infer the repo root as the workspace root.
    root: import.meta.dirname,
  },
};

export default nextConfig;
