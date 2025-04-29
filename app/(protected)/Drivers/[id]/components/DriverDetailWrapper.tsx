"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Driver } from "../../types";
import DriverDetail from "./DriverDetail";
import { useDrivers } from "../../components/DriversClientProvider";
import { getDriverAction } from "../../server-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter, usePathname } from "next/navigation";
import {
  getSelectedDriver,
  storeSelectedDriver,
  addToRecentDrivers,
} from "../../utils";

interface DriverDetailWrapperProps {
  serverDriver: Driver | null;
  driverId: string;
  skipInitialFetch?: boolean;
}

export default function DriverDetailWrapper({
  serverDriver,
  driverId,
  skipInitialFetch = false,
}: DriverDetailWrapperProps) {
  const { selectedDriver, setSelectedDriver, getDriverById, drivers } =
    useDrivers();

  const router = useRouter();
  const pathname = usePathname();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isFadeOut, setIsFadeOut] = useState(false);
  const prefetchedDriversRef = useRef<Set<string>>(new Set());
  const [forceRefresh, setForceRefresh] = useState(0);

  // First check context, then session storage, then fallback to server data
  const storedDriver = getSelectedDriver();
  const cachedDriver =
    selectedDriver || getDriverById(driverId) || storedDriver;
  const initialDriver = cachedDriver || serverDriver;

  // Use the cached driver or server driver, preferring the cached driver for instant display
  const [displayDriver, setDisplayDriver] = useState<Driver | null>(
    initialDriver
  );

  // When the component mounts, set initial load to false after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Refresh the driver data in the background if needed
  useEffect(() => {
    // Skip the initial fetch if we're told to, or if we already have a server driver
    if (skipInitialFetch && initialDriver) return;

    // If we initially show the cached driver or have no driver, refresh it from the server
    const refreshFromServer = async () => {
      try {
        setIsRefreshing(true);
        const freshDriver = await getDriverAction(Number(driverId));
        if (freshDriver) {
          // Use a smooth transition for data updates
          setIsFadeOut(true);
          setTimeout(() => {
            setDisplayDriver(freshDriver);
            setSelectedDriver(freshDriver);
            // Update session storage
            storeSelectedDriver(freshDriver);
            setTimeout(() => {
              setIsFadeOut(false);
            }, 150);
          }, 150);
        }
      } catch (error) {
        console.error("Error refreshing driver:", error);
      } finally {
        setIsRefreshing(false);
      }
    };

    refreshFromServer();
  }, [
    driverId,
    serverDriver,
    initialDriver,
    skipInitialFetch,
    setSelectedDriver,
  ]);

  // Add real-time update detection

  // When we receive a real-time update, show a refreshing state temporarily
  const markAsRefreshing = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1500); // Show the refreshing state for 1.5 seconds
  };

  // Modify the effect that processes real-time updates
  useEffect(() => {
    // Check if the displayed driver is different from the selected driver
    if (
      selectedDriver &&
      displayDriver &&
      selectedDriver.id === displayDriver.id &&
      JSON.stringify(selectedDriver) !== JSON.stringify(displayDriver)
    ) {
      console.log("Detected real-time update to the current driver", {
        selected: selectedDriver,
        displayed: displayDriver,
      });

      // Show refreshing state
      markAsRefreshing();

      // Force a refresh by using a counter state
      setForceRefresh((prev) => prev + 1);

      // If the selected driver has changed (via real-time updates), update the display
      // with a visual transition
      setIsFadeOut(true);
      setTimeout(() => {
        // Create a new object to ensure React detects the change
        setDisplayDriver({ ...selectedDriver });
        setTimeout(() => {
          setIsFadeOut(false);
        }, 150);
      }, 150);
    }
  }, [selectedDriver, displayDriver]);

  // Add a second useEffect that responds to the forceRefresh counter
  useEffect(() => {
    if (forceRefresh > 0 && selectedDriver) {
      console.log("Force refreshing driver UI", forceRefresh);
      // Deep clone the object to ensure React treats it as a new reference
      setDisplayDriver(JSON.parse(JSON.stringify(selectedDriver)));
    }
  }, [forceRefresh, selectedDriver]);

  // Update the display driver if server data comes in
  useEffect(() => {
    if (serverDriver) {
      setDisplayDriver(serverDriver);
      setSelectedDriver(serverDriver);
      // Update session storage
      storeSelectedDriver(serverDriver);
    }
  }, [serverDriver, setSelectedDriver]);

  // Prefetch neighboring drivers for faster navigation
  useEffect(() => {
    if (!drivers || drivers.length === 0) return;

    const prefetchNeighboringDrivers = async () => {
      // Find the current driver's index
      const currentIndex = drivers.findIndex((d) => String(d.id) === driverId);
      if (currentIndex === -1) return;

      // Get the next and previous driver IDs
      const prevDriverId =
        currentIndex > 0 ? String(drivers[currentIndex - 1].id) : null;
      const nextDriverId =
        currentIndex < drivers.length - 1
          ? String(drivers[currentIndex + 1].id)
          : null;

      // Prefetch the next and previous drivers if they exist
      const prefetch = async (id: string | null) => {
        if (!id || prefetchedDriversRef.current.has(id)) return;

        try {
          // Prefetch the route first
          await router.prefetch(`/Drivers/${id}`);
          prefetchedDriversRef.current.add(id);

          // Then optionally prefetch the data if it's not already in our context
          if (!getDriverById(id)) {
            // Low priority fetch - won't block anything
            getDriverAction(Number(id)).catch(() => {});
          }
        } catch (error) {
          console.error(`Error prefetching driver ${id}:`, error);
        }
      };

      // Prefetch both in parallel
      if (prevDriverId) prefetch(prevDriverId);
      if (nextDriverId) prefetch(nextDriverId);
    };

    prefetchNeighboringDrivers();
  }, [driverId, drivers, router, getDriverById]);

  // Create navigation helpers for previous/next driver
  const navigateToDriver = useCallback(
    (newDriverId: string) => {
      // Set transitioning state for animation
      setIsTransitioning(true);

      const newDriver = getDriverById(newDriverId);
      if (newDriver) {
        setSelectedDriver(newDriver);
        storeSelectedDriver(newDriver);
      }

      setTimeout(() => {
        router.push(`/Drivers/${newDriverId}`);
        setTimeout(() => {
          setIsTransitioning(false);
        }, 300);
      }, 150);
    },
    [router, setSelectedDriver, getDriverById]
  );

  const goToPreviousDriver = useCallback(() => {
    if (!drivers || drivers.length === 0) return;

    const currentIndex = drivers.findIndex((d) => String(d.id) === driverId);
    if (currentIndex <= 0) return; // No previous driver

    const prevDriverId = String(drivers[currentIndex - 1].id);
    navigateToDriver(prevDriverId);
  }, [driverId, drivers, navigateToDriver]);

  const goToNextDriver = useCallback(() => {
    if (!drivers || drivers.length === 0) return;

    const currentIndex = drivers.findIndex((d) => String(d.id) === driverId);
    if (currentIndex === -1 || currentIndex >= drivers.length - 1) return; // No next driver

    const nextDriverId = String(drivers[currentIndex + 1].id);
    navigateToDriver(nextDriverId);
  }, [driverId, drivers, navigateToDriver]);

  // Manual refresh function that can be triggered by a button
  const handleManualRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const freshDriver = await getDriverAction(Number(driverId));
      if (freshDriver) {
        setIsFadeOut(true);
        setTimeout(() => {
          setDisplayDriver(freshDriver);
          setSelectedDriver(freshDriver);
          storeSelectedDriver(freshDriver);
          setTimeout(() => {
            setIsFadeOut(false);
          }, 150);
        }, 150);
      }
    } catch (error) {
      console.error("Error manually refreshing driver:", error);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 500); // Show loading state for at least 500ms for better UX
    }
  }, [driverId, setSelectedDriver]);

  // Attach keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only respond to arrow keys if we're on a driver details page
      if (!pathname.startsWith("/Drivers/")) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPreviousDriver();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNextDriver();
      } else if (e.key === "r" && (e.ctrlKey || e.metaKey)) {
        // Ctrl+R or Cmd+R for manual refresh
        e.preventDefault();
        handleManualRefresh();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pathname, goToPreviousDriver, goToNextDriver, handleManualRefresh]);

  // When this component mounts with a driver, add it to the recent drivers list
  useEffect(() => {
    if (displayDriver) {
      addToRecentDrivers(displayDriver);
    }
  }, [displayDriver]);

  if (!displayDriver) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`transition-opacity duration-300 ${isInitialLoad || isTransitioning || isFadeOut ? "opacity-80" : "opacity-100"}`}
    >
      <DriverDetail
        driver={displayDriver}
        driverId={driverId}
        isRefreshing={isRefreshing}
        onPrevious={goToPreviousDriver}
        onNext={goToNextDriver}
        onRefresh={handleManualRefresh}
      />
    </div>
  );
}
