"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { handleSignOut } from "@/utils/auth";

export default function AlreadySignedIn() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        className="max-w-md w-full space-y-8 p-8 bg-background rounded-lg shadow-lg text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex justify-center">
          <Image
            src="/logo.webp"
            alt="UnoStar Logo"
            width={80}
            height={80}
            className="mb-4"
          />
        </div>

        <h1 className="text-2xl font-bold">Already Signed In</h1>

        <p className="text-muted-foreground mt-2">
          You are already signed in. Would you like to go back to your dashboard
          or sign out?
        </p>

        <div className="space-y-4 mt-6">
          <Button onClick={() => router.push("/Dashboard")} className="w-full">
            Go to Dashboard
          </Button>

          <Button onClick={handleSignOut} variant="outline" className="w-full">
            Sign Out
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
