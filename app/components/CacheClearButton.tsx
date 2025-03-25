"use client";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface CacheClearButtonProps {
  clearCache: () => Promise<void>;
  label?: string;
}

export function CacheClearButton({
  clearCache,
  label = "Clear Cache",
}: CacheClearButtonProps) {
  const router = useRouter();

  const handleClearCache = async () => {
    try {
      await clearCache();
      toast.success("Cache cleared successfully");
      router.refresh();
    } catch (error) {
      console.error("Error clearing cache:", error);
      toast.error("Failed to clear cache");
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleClearCache}
      className="flex items-center gap-2"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M3 21v-5h5" />
      </svg>
      {label}
    </Button>
  );
}
