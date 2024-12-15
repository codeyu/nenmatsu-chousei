import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export', // 启用静态导出
  basePath: process.env.NODE_ENV === 'production' ? '/nenmatsu-chousei' : '', // 替换为你的仓库名
  images: {
    unoptimized: true // 对于静态导出，需要禁用图像优化
  }
};

export default nextConfig;
