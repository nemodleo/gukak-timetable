import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // /docs/[slug] reads docs/*.md with fs at request time (the app is fully
  // dynamic — the root layout reads the auth cookie); make sure the
  // serverless function's file trace actually includes those markdown
  // files, since a dynamic property-indexed path isn't reliably traced.
  outputFileTracingIncludes: {
    "/docs/*": ["./docs/*.md"],
  },
};

export default nextConfig;
