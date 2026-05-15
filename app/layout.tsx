import type { Metadata } from "next";
import { Orbitron, Space_Mono, DM_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ChatBot } from "@/components/ChatBot/ChatBot";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
          <div className="min-h-screen relative overflow-x-hidden bg-gradient-to-br from-background via-background to-accent-primary/10">
            {children}
            <ErrorBoundary>
              <ChatBot />
            </ErrorBoundary>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
