import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leave your mark",
  description: "Add your page to the conference memento book.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MementoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
