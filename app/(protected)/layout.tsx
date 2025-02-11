"use client";

import { TopNav } from "@/components/Nav/topNav";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "next/navigation";
import { BirthdayCheck } from "@/components/birthday-check";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userRole, userName, userEmail, isLoading, isHydrated } = useUser();
  const router = useRouter();

  return (
    <div className="min-h-screen relative">
      <TopNav userRole={userRole} userName={userName} userEmail={userEmail} />
      <main className="px-4 py-4">{children}</main>
      <BirthdayCheck />
    </div>
  );
}
