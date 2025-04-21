"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function LoadingBar() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;

    const startLoading = () => {
      setLoading(true);
      setProgress(0);
      progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);
    };

    const finishLoading = () => {
      setProgress(100);
      clearInterval(progressInterval);
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 200);
    };

    // Start loading when navigation begins
    startLoading();

    // Finish loading when navigation completes
    const cleanup = setTimeout(finishLoading, 500);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(cleanup);
    };
  }, [pathname, searchParams]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-50">
      <div
        className="h-full bg-blue-500 transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          transition: "width 200ms ease-out",
        }}
      />
    </div>
  );
}
