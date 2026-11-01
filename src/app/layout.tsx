import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getSession } from "@/lib/auth";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://buildforge-construction.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Hama Construction | Building Innovation Through Quality and Trust",
    template: "%s | Hama Construction",
  },
  description:
    "Buy and reserve houses, hotels and land. Hire tools and construction workers. Request a project quote. Building innovation through quality and trust.",
  openGraph: {
    title: "Hama Construction",
    description: "Building innovation through quality and trust.",
    url: siteUrl,
    siteName: "Hama Construction",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hama Construction",
    description: "Building innovation through quality and trust.",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col antialiased">
        <Navbar user={session} />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
