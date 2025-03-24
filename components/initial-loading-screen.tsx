"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function InitialLoadingScreen() {
  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <motion.div
        className="flex flex-col items-center space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="relative w-24 h-24">
          <Image
            src="/logo.webp"
            alt="UnoStar Logo"
            fill
            className="object-contain"
          />
        </div>
        <motion.div
          className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden"
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="h-full bg-primary w-full transform -translate-x-full animate-loading-bar" />
        </motion.div>
        <p className="text-lg font-medium text-muted-foreground">
          Loading your workspace...
        </p>
      </motion.div>
    </div>
  );
}
