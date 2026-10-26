import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Hama Construction | Assets, Tools & Project Management",
  description:
    "Buy and reserve houses, hotels, land. Hire tools and construction workers. Manage your building projects with Hama Construction.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
