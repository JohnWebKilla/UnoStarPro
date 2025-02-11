"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BirthdayOverlayProps {
  userName: string;
  onClose: () => void;
}

export function BirthdayOverlay({ userName, onClose }: BirthdayOverlayProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      >
        <motion.div
          key="modal"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
          }}
          className="relative bg-background rounded-lg p-6 shadow-lg max-w-md w-full mx-4 text-center"
        >
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="absolute right-2 top-2 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </motion.button>

          <div className="space-y-4">
            <div className="relative w-full aspect-square">
              <img
                src="/birthday-party.gif"
                alt="Birthday celebration"
                className="w-full h-full object-contain"
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-2xl font-bold">
                🎉 Happy Birthday, {userName}! 🎂
              </h2>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-muted-foreground"
            >
              Wishing you an amazing day filled with joy and celebration!
            </motion.p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
