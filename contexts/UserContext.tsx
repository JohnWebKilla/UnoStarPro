"use client";

import type { Role } from "@/types/role";
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo,
} from "react";

type UserContextType = {
  userRole: Role | null;
  setUserRole: (role: Role | null) => void;
  userName: string;
  setUserName: (name: string) => void;
  userEmail: string;
  setUserEmail: (email: string) => void;
  isLoading: boolean;
  isHydrated: boolean;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
    // Load data from localStorage after hydration
    const savedRole = localStorage.getItem("userRole");
    const savedName = localStorage.getItem("userName");
    const savedEmail = localStorage.getItem("userEmail");

    if (savedRole) setUserRole(JSON.parse(savedRole));
    if (savedName) setUserName(savedName);
    if (savedEmail) setUserEmail(savedEmail);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      const hasAllData = userRole && userName && userEmail;
      setIsLoading(!hasAllData);
    }
  }, [isHydrated, userRole, userName, userEmail]);

  // Persist state changes to localStorage
  useEffect(() => {
    if (isHydrated) {
      if (userRole) localStorage.setItem("userRole", JSON.stringify(userRole));
      if (userName) localStorage.setItem("userName", userName);
      if (userEmail) localStorage.setItem("userEmail", userEmail);
    }
  }, [isHydrated, userRole, userName, userEmail]);

  const value = useMemo(
    () => ({
      userRole,
      setUserRole,
      userName,
      setUserName,
      userEmail,
      setUserEmail,
      isLoading,
      isHydrated,
    }),
    [userRole, userName, userEmail, isLoading, isHydrated]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
