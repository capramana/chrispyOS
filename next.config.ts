import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com", "*.loca.lt"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/memento/book",
        destination: "https://config.chrispramana.com",
        permanent: true,
      },
      {
        source: "/favicon.ico",
        destination: "/icon.png",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
