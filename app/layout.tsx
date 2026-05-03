import type { Metadata } from "next";
import { Geist_Mono, Zalando_Sans } from "next/font/google";
import "./globals.css";
import AgentationWrapper from "./components/AgentationWrapper";

const zalandoSans = Zalando_Sans({
  variable: "--font-zalando-sans",
  subsets: ["latin"],
  display: "swap",
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Menlo",
    "Monaco",
    "Consolas",
    "Liberation Mono",
    "Courier New",
    "monospace",
  ],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL != null &&
  process.env.NEXT_PUBLIC_SITE_URL !== ""
    ? process.env.NEXT_PUBLIC_SITE_URL
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Chris Pramana",
    template: "%s · Chris Pramana",
  },
  description: "builds products with intention and care",
  openGraph: {
    title: "Chris Pramana",
    description: "builds products with intention and care",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Chris Pramana",
    description: "builds products with intention and care",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${zalandoSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Cambio / Base UI: root isolation so portaled layers stack predictably above in-flow UI */}
        <div className="isolate">{children}</div>
        <AgentationWrapper />
      </body>
    </html>
  );
}
