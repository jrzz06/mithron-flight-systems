import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { JsonLd } from "@/components/seo/json-ld";
import { ObservabilityProvider } from "@/components/providers/observability-provider";
import { buildSiteStructuredData } from "@/lib/structured-data";
import { getSiteUrl } from "@/lib/site-url";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  adjustFontFallback: true
});

const siteUrl = getSiteUrl();
const siteStructuredData = buildSiteStructuredData();

export const metadata: Metadata = {
  applicationName: "Mithron Flight Systems",
  title: "Mithron Flight Systems",
  description: "Cinematic Mithron drone technology, smart agriculture, mapping, and surveillance platform experience.",
  metadataBase: siteUrl,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Mithron Flight Systems",
    title: "Mithron Flight Systems",
    description: "Drone systems, spares, support, and field-ready products for agriculture, mapping, and surveillance."
  },
  robots: {
    index: true,
    follow: true
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050505"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={inter.variable}
    >
      <body suppressHydrationWarning>
        <JsonLd data={siteStructuredData} />
        <ObservabilityProvider>{children}</ObservabilityProvider>
      </body>
    </html>
  );
}
