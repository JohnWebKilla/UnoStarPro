"use client";

import { motion } from "framer-motion";
import Image from "next/image";

interface InitialLoadingScreenProps {
  message?: string;
}

export function InitialLoadingScreen({
  message = "Loading your workspace...",
}: InitialLoadingScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative">
          <img src="/logo.webp" alt="UnoStar Logo" className="w-16 h-16" />
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
            <div className="loading-dots flex space-x-1">
              <div
                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <div
                className="w-2 h-2 bg-primary rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        </div>
        <p className="text-muted-foreground mt-4">{message}</p>
      </div>
    </div>
  );
}
