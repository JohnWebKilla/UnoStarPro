"use client";

import { TopNav } from "@/components/Nav/topNav";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { BirthdayCheck } from "@/components/birthday-check";
import { NotificationProvider } from "@/app/(protected)/Banners/components/NotificationProvider";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userRole, userName, userEmail, isLoading } = useUser();
  const router = useRouter();

  // Redirect to sign-in if not authenticated after loading
  useEffect(() => {
    if (!isLoading && !userRole) {
      router.replace("/sign-in");
    }
  }, [isLoading, userRole, router]);

  // Always render the layout with appropriate loading states
  return (
    <div className="min-h-screen relative">
      <NotificationProvider>
        <TopNav
          userRole={userRole}
          userName={userName}
          userEmail={userEmail}
          isLoading={isLoading}
        />
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-4">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading your dashboard...</p>
            </div>
          </div>
        ) : userRole ? (
          <>
            <main className="px-4 py-4">{children}</main>
            <BirthdayCheck />
          </>
        ) : null}
      </NotificationProvider>
    </div>
  );
}
