import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ColorSchemeScript } from '@mantine/core';
import { Providers } from "@/lib/providers";
import { APP_NAME, APP_DESCRIPTION } from "@/constants";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: `%s | ${APP_NAME}`,
    default: APP_NAME,
  },
  description: APP_DESCRIPTION,
  keywords: [
    "EMR",
    "Electronic Medical Records",
    "Healthcare",
    "Medical Software",
    "Patient Management",
    "Clinical Documentation",
    "HIPAA Compliant",
    "Medplum",
    "Healthcare Technology",
  ],
  authors: [{ name: "OmniCare Development Team" }],
  creator: "OmniCare",
  publisher: "OmniCare",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <ColorSchemeScript />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#0091FF" />
      </head>
      <body className="font-inter antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
