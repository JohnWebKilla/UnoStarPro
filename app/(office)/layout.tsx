import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "next-themes";
import { TopNav } from "@/components/Nav/topNav";

export const metadata = {
  title: "Office Dashboard",
  description: "Uno Star Solutions Office Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.className} suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TopNav />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
