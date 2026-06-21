import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { ObservabilityProvider } from "@/components/providers/observability-provider";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  adjustFontFallback: true
});

function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mithron.com";

  try {
    return new URL(configuredUrl);
  } catch {
    return new URL("https://mithron.com");
  }
}

const siteUrl = getSiteUrl();

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
    icon: "/favicon.svg"
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
      className={manrope.variable}
    >
      <body suppressHydrationWarning>
        <ObservabilityProvider>{children}</ObservabilityProvider>
      </body>
    </html>
  );
}
