import type { Metadata } from "next";
import "./globals.css";
import AgentationWrapper from "./components/AgentationWrapper";
import { geistMono, zalandoSans } from "./fonts";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL != null &&
  process.env.NEXT_PUBLIC_SITE_URL !== ""
    ? process.env.NEXT_PUBLIC_SITE_URL
    : "http://localhost:3000";

const siteDescription = "is obsessed with missions for generational progress";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Chris Pramana",
    template: "%s · Chris Pramana",
  },
  description: siteDescription,
  openGraph: {
    title: "Chris Pramana",
    description: siteDescription,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Chris Pramana",
    description: siteDescription,
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
        className={`${zalandoSans.variable} ${zalandoSans.className} ${geistMono.variable} antialiased`}
      >
        <div className="isolate">{children}</div>
        <AgentationWrapper />
      </body>
    </html>
  );
}
