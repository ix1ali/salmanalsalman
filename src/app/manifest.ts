import type { MetadataRoute } from "next";

/** يجعل الموقع يُثبَّت كتطبيق على الجوال وسطح المكتب باسمه وأيقونته. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "إدارة عقار سلمان السلمان",
    short_name: "عقار السلمان",
    description: "نظام إدارة العمارات والشقق والمستأجرين والإيجارات.",
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#f4f6f6",
    theme_color: "#0f5b57",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
