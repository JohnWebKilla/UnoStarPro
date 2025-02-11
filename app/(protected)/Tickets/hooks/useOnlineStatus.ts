"use client";

import { useState, useEffect } from "react";

// Mock online status - replace with your actual online status logic
const mockOnlineStatuses: { [key: string]: boolean } = {
  user1: true,
  user2: false,
  driver1: true,
  driver2: true,
};

export function useOnlineStatus() {
  const [onlineUsers, setOnlineUsers] = useState<{ [key: string]: boolean }>(
    mockOnlineStatuses
  );

  // In a real app, you'd want to subscribe to user status changes here
  useEffect(() => {
    // Mock status changes
    const interval = setInterval(() => {
      setOnlineUsers((prev) => ({
        ...prev,
        [Object.keys(prev)[
          Math.floor(Math.random() * Object.keys(prev).length)
        ]]: Math.random() > 0.5,
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return onlineUsers;
}
