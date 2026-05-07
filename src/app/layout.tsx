import type { Metadata } from "next";
import { JetBrains_Mono, Titillium_Web } from "next/font/google";

import "./globals.css";

const titillium = Titillium_Web({
  subsets: ["latin"],
  variable: "--font-titillium",
  weight: ["400", "600", "700", "900"],
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  description: "Secure league operations for F1 esports seasons.",
  title: "F1 Esports League Manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${titillium.variable} ${jetBrainsMono.variable} h-full antialiased`}
      lang="en"
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
