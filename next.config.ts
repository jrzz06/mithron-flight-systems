import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)));

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()"
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload"
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin"
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-site"
  }
];

function supabaseImageHostname() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL is required in production.");
    }
    return "localhost";
  }

  try {
    return new URL(rawUrl).hostname;
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: appRoot
  },
  images: {
    localPatterns: [
      { pathname: "/media/**" },
      { pathname: "/assets/**" },
      { pathname: "/optimized/**" }
    ],
    remotePatterns: [{ protocol: "https", hostname: supabaseImageHostname() }],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [64, 96, 160, 256, 384]
  },
  experimental: {
    optimizePackageImports: ["lucide-react"]
  },
  async redirects() {
    return [
      { source: "/favicon.ico", destination: "/favicon.svg", permanent: true },
      { source: "/agriculture", destination: "/category/agri-drones", permanent: true },
      { source: "/video-drones", destination: "/category/video-drones", permanent: true },
      { source: "/creative-drones", destination: "/category/creative-drones", permanent: true },
      { source: "/mapping", destination: "/category/survey-drones", permanent: true },
      { source: "/surveillance", destination: "/category/surveillance-drones", permanent: true },
      { source: "/accessories", destination: "/category/accessories", permanent: true },
      { source: "/industrial", destination: "/category/global-products", permanent: true },
      { source: "/supplier/orders", destination: "/supplier", permanent: true }
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      },
      {
        source: "/optimized/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        source: "/media/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
