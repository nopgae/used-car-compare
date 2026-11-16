import type { NextConfig } from "next";

// GitHub Pages(nopgae.github.io/used-car-compare)에 정적 파일로 올린다
const basePath = "/used-car-compare";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
