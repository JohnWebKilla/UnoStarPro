"use client";
import { ThemeProvider } from "next-themes";
import { GeistSans } from "geist/font/sans";
import { UserProvider } from "@/contexts/UserContext";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import { NotificationProvider } from "@/app/(protected)/Banners/components/NotificationProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { toast } = useToast();

  // Example usage
  const handleClick = () => {
    toast({
      title: "Success",
      description: "Operation completed successfully",
    });
  };

  return (
    <html lang="en" className={GeistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <UserProvider>
            <NotificationProvider
              initialSettings={{
                enabled: true,
                defaultPosition: "top",
                defaultDuration: 5000,
                defaultDismissible: true,
                autoTranslate: false,
                supportedLanguages: ["en"],
              }}
            >
              {children}
            </NotificationProvider>
          </UserProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
