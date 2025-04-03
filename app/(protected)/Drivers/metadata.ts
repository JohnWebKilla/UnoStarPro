import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Drivers | UnoStarPro",
  description: "Manage your drivers and their documents",
  keywords: [
    "drivers management",
    "fleet management",
    "document tracking",
    "driver status",
  ],
  openGraph: {
    title: "Drivers Management | UnoStarPro",
    description: "Comprehensive driver management system for fleet operators",
    type: "website",
    images: [
      {
        url: "/images/drivers-management.png",
        width: 1200,
        height: 630,
        alt: "UnoStarPro Drivers Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Drivers Management | UnoStarPro",
    description: "Comprehensive driver management system for fleet operators",
    images: ["/images/drivers-management.png"],
  },
};
