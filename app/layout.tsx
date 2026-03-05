import type { Metadata } from "next";
import { Geist_Mono, Zalando_Sans } from "next/font/google";
import "./globals.css";
import AgentationWrapper from "./components/AgentationWrapper";

const zalandoSans = Zalando_Sans({
  variable: "--font-zalando-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chris Pramana",
  description: "builds products with intention and care",
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
        {children}
        <AgentationWrapper />
      </body>
    </html>
  );
}
