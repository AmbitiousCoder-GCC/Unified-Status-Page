import type { Metadata } from "next";
import { Orbitron, Space_Mono, DM_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ChatBot } from "@/components/ChatBot/ChatBot";

const orbitron = Orbitron({ 
  subsets: ["latin"], 
  variable: "--font-orbitron",
  display: "swap"
});

const spaceMono = Space_Mono({ 
  weight: ["400", "700"],
  subsets: ["latin"], 
  variable: "--font-space-mono",
  display: "swap"
});

const dmSans = DM_Sans({ 
  subsets: ["latin"], 
  variable: "--font-dm-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Nexus Status Grid | Real-Time Vendor Uptime Monitor",
  description: "Live uptime monitoring for GitLab, MongoDB, GitHub, Google Cloud, Auth0, Databricks, Cloudflare, Azure, Snowflake, SailPoint & Cycode. 15-day availability stats updated every 60 seconds.",
  keywords: ["status page", "uptime monitor", "vendor status", "GitLab status", "MongoDB status", "GitHub status", "Google Cloud status", "Azure status", "Snowflake status", "Cloudflare status", "Auth0 status", "Databricks status"],
  authors: [{ name: "Nexus Status Grid" }],
  openGraph: {
    title: "Nexus Status Grid",
    description: "Real-time vendor uptime intelligence dashboard",
    type: "website",
    images: ["/og-image.png"]
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${orbitron.variable} ${spaceMono.variable} ${dmSans.variable} font-dmsans antialiased`}>
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
          <div className="min-h-screen scanlines relative overflow-x-hidden">
            <div className="absolute inset-0 bg-grid-pattern opacity-50 z-[-1] pointer-events-none" />
            {children}
            <ChatBot />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
