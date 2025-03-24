"use client";

import { useEffect, useState } from "react";
import {
  getPageData,
  refreshPageData,
  PageData,
} from "@/lib/client-cache-manager";
import { useUser } from "@/contexts/UserContext";
import { usePathname } from "next/navigation";

export function usePageData<T = any>() {
  const pathname = usePathname();
  const { userEmail, userRole } = useUser();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!userEmail || !userRole) return;

      try {
        setIsLoading(true);
        setError(null);

        const pageData = await getPageData(userEmail, pathname);

        if (!pageData) {
          // If data is not in cache, try to fetch it
          await refreshPageData(userEmail, userRole, pathname);
          const freshData = await getPageData(userEmail, pathname);
          if (isMounted && freshData) {
            setData(freshData.data);
          }
        } else if (isMounted) {
          setData(pageData.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch page data"
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [pathname, userEmail, userRole]);

  const refetch = async () => {
    if (!userEmail || !userRole) return;

    try {
      setIsLoading(true);
      setError(null);

      await refreshPageData(userEmail, userRole, pathname);
      const freshData = await getPageData(userEmail, pathname);
      if (freshData) {
        setData(freshData.data);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh page data"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}
