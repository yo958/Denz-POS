import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // TypeScript is checked locally via `tsc --noEmit` before every push.
  // Skipping it here avoids OOM on the Firebase App Hosting Cloud Build machine
  // (heap hits ~2 GB during type checking, exceeding the build runner limit).
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
