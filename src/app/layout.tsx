import type { Metadata, Viewport } from "next";
import { Tajawal, Cairo } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const body = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

const display = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://salmanalsalman.app"),
  title: "إدارة عقار سلمان السلمان",
  description: "نظام متكامل لإدارة العمارات والشقق والمستأجرين والعقود والإيجارات في الكويت.",
  applicationName: "عقار السلمان",
  appleWebApp: { capable: true, title: "عقار السلمان", statusBarStyle: "default" },
  // معاينة الرابط عند إرساله في واتساب أو غيره
  openGraph: {
    type: "website",
    siteName: "إدارة عقار سلمان السلمان",
    title: "إدارة عقار سلمان السلمان",
    description: "العمارات والشقق والمستأجرون والعقود والإيجارات في مكان واحد.",
    locale: "ar_KW",
    url: "/",
  },
  twitter: { card: "summary_large_image", title: "إدارة عقار سلمان السلمان" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f5b57",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${body.variable} ${display.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
