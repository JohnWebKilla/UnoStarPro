"use client";

import { TopNav } from "@/components/Nav/topNav";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { AUTH_ROUTES } from "@/utils/protected";
import { useEffect } from "react";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userRole, userName, userEmail, isLoading, isHydrated } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && !isLoading && !userRole) {
      router.push(AUTH_ROUTES.SIGN_IN);
    }
  }, [isHydrated, isLoading, userRole, router]);

  // Don't render anything until hydrated
  if (!isHydrated) {
    return <LoadingOverlay />;
  }

  return (
    <div className="min-h-screen relative">
      <TopNav userRole={userRole} userName={userName} userEmail={userEmail} />
      <main className="px-4 py-8">{children}</main>
      {isLoading && <LoadingOverlay />}
    </div>
  );
}
