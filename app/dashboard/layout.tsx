import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel del organizador | Door List",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
