import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

// عائلة واحدة بأوزان متعددة — أوضح وأكثر تماسكًا من خلط خطين
const body = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "إدارة العمارات | إدارة عقار سلمان السلمان",
  description: "نظام متكامل لإدارة العمارات والشقق والمستأجرين والعقود والإيجارات في الكويت.",
  applicationName: "إدارة العمارات",
  appleWebApp: { capable: true, title: "إدارة العمارات", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#17324e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={body.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
