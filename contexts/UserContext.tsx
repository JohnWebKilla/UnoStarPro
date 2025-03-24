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

interface UserContextType {
  userRole: Role | null;
  userName: string | null;
  userEmail: string | null;
  setUserRole: (role: Role | null) => void;
  setUserName: (name: string | null) => void;
  setUserEmail: (email: string | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // Load user data from localStorage on mount
    const savedRole = localStorage.getItem("userRole");
    const savedName = localStorage.getItem("userName");
    const savedEmail = localStorage.getItem("userEmail");

    if (savedRole) {
      try {
        const parsedRole = JSON.parse(savedRole) as Role;
        setUserRole(parsedRole);
      } catch (error) {
        console.error("Error parsing saved role:", error);
        // If there's an error parsing the role, clear it
        localStorage.removeItem("userRole");
      }
    }
    if (savedName) setUserName(savedName);
    if (savedEmail) setUserEmail(savedEmail);
  }, []);

  return (
    <UserContext.Provider
      value={{
        userRole,
        userName,
        userEmail,
        setUserRole,
        setUserName,
        setUserEmail,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
