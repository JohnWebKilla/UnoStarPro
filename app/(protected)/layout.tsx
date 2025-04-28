"use client";

import { SideNav } from "@/components/Nav/SideNav";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { BirthdayCheck } from "@/components/birthday-check";
import { NotificationProvider } from "@/app/(protected)/Banners/components/NotificationProvider";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userRole, userName, userEmail, isLoading, isInitialLoad } = useUser();
  const router = useRouter();

  // Redirect to sign-in if not authenticated after loading
  useEffect(() => {
    if (!isLoading && !userRole) {
      router.replace("/sign-in");
    }
  }, [isLoading, userRole, router]);

  return (
    <div className="min-h-screen bg-background">
      <SidebarProvider>
        <NotificationProvider>
          <SideNav
            userRole={userRole}
            userName={userName}
            userEmail={userEmail}
            isLoading={isLoading}
          >
            <AnimatePresence mode="wait">
              {isLoading && isInitialLoad ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center min-h-[calc(100vh-2rem)] p-4"
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <div className="absolute inset-0 h-8 w-8 animate-ping rounded-full bg-primary/20" />
                    </div>
                    <p className="text-muted-foreground animate-pulse">
                      Loading your dashboard...
                    </p>
                  </div>
                </motion.div>
              ) : userRole ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="p-6"
                >
                  {children}
                  <BirthdayCheck />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </SideNav>
        </NotificationProvider>
      </SidebarProvider>
    </div>
  );
}
