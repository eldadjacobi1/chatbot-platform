import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter_Tight } from "next/font/google";
import "./globals.css";

const sans = Inter_Tight({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Chatbot Platform",
  description: "A website chatbot for your business",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <ClerkProvider
          appearance={{
            variables: { colorPrimary: "#4338ca", colorForeground: "#14142b", borderRadius: "0.75rem" },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
