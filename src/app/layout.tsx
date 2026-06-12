import type { Metadata } from "next";
import { Work_Sans } from "next/font/google";
import "./globals.css";

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "hello planning",
  description: "Resource planning — Hello Tomorrow",
  icons: {
    icon: [
      {
        url: "/favicon-b.svg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon-w.svg",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${workSans.variable} h-full antialiased`}>
      <body className="h-full flex flex-col bg-background text-foreground overflow-hidden">
        {children}
      </body>
    </html>
  );
}
