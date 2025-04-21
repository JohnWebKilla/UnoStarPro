import React, { useState, useEffect, createContext, useCallback } from "react";

interface Driver {
  id: string;
  name: string;
  status: string;
  // Add other driver properties as needed
}

interface DriversContextType {
  drivers: Driver[];
  setDrivers: React.Dispatch<React.SetStateAction<Driver[]>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTab: string;
  handleTabChange: (tab: string) => void;
  processingDrivers: Record<string, boolean>;
  setProcessingDriver: (id: string, processing: boolean) => void;
  updateDriverOptimistically: (id: string, updates: Partial<Driver>) => void;
  updateDrivers: (id: number, data: Partial<Driver>) => Promise<Driver>;
}

export const DriversContext = createContext<DriversContextType>({
  drivers: [],
  setDrivers: () => {},
  isLoading: true,
  setIsLoading: () => {},
  selectedTab: "drivers",
  handleTabChange: () => {},
  processingDrivers: {},
  setProcessingDriver: () => {},
  updateDriverOptimistically: () => {},
  updateDrivers: async () => ({ id: "", name: "", status: "" }),
});

const CACHE_KEY = "drivers:data";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function DriversProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [processingDrivers, setProcessingDrivers] = useState<
    Record<string, boolean>
  >({});
  const [drivers, setDrivers] = useState<Driver[]>(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }
    return [];
  });
  const [selectedTab, setSelectedTab] = useState<string>("drivers");

  const setProcessingDriver = useCallback((id: string, processing: boolean) => {
    setProcessingDrivers((prev) => ({ ...prev, [id]: processing }));
  }, []);

  const updateDriverOptimistically = useCallback(
    (id: string, updates: Partial<Driver>) => {
      setDrivers((prevDrivers) =>
        prevDrivers.map((driver) =>
          driver.id === id ? { ...driver, ...updates } : driver
        )
      );
    },
    []
  );

  const updateDrivers = useCallback(
    async (id: number, data: Partial<Driver>): Promise<Driver> => {
      try {
        const response = await fetch(`/api/drivers/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error("Failed to update driver");
        }

        const updatedDriver = await response.json();

        // Update the drivers state and cache
        setDrivers((prevDrivers) =>
          prevDrivers.map((driver) =>
            driver.id === id.toString()
              ? { ...driver, ...updatedDriver }
              : driver
          )
        );

        // Update cache
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              data: drivers.map((driver) =>
                driver.id === id.toString()
                  ? { ...driver, ...updatedDriver }
                  : driver
              ),
              timestamp,
            })
          );
        }

        return updatedDriver;
      } catch (error) {
        console.error("Error updating driver:", error);
        throw error;
      }
    },
    [drivers]
  );

  const fetchDrivers = useCallback(async (force = false) => {
    if (!force) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setDrivers(data);
          return;
        }
      }
    }

    try {
      if (force) {
        setIsLoading(true);
      }

      const response = await fetch("/api/drivers");
      const data = await response.json();
      setDrivers(data);

      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error("Error fetching drivers:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTab === "drivers" && drivers.length === 0) {
      fetchDrivers();
    }
  }, [selectedTab, drivers.length, fetchDrivers]);

  const handleTabChange = (tab: string) => {
    setSelectedTab(tab);
    if (tab === "drivers" && drivers.length === 0) {
      fetchDrivers();
    }
  };

  const value = {
    drivers,
    setDrivers,
    isLoading,
    setIsLoading,
    selectedTab,
    handleTabChange,
    processingDrivers,
    setProcessingDriver,
    updateDriverOptimistically,
    updateDrivers,
  };

  return (
    <DriversContext.Provider value={value}>{children}</DriversContext.Provider>
  );
}
