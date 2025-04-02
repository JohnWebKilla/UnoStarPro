"use client";

import type { Role } from "@/types/role";
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter, usePathname } from "next/navigation";

interface CachedNavData {
  userRole: Role | null;
  userName: string | null;
  userEmail: string | null;
}

interface UserContextType {
  userRole: Role | null;
  userName: string | null;
  userEmail: string | null;
  isLoading: boolean;
  setUserRole: (role: Role | null) => void;
  setUserName: (name: string | null) => void;
  setUserEmail: (email: string | null) => void;
}

const STORAGE_KEY = "unostar_session";

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  const initRef = useRef(false);
  const authListenerRef = useRef<{ unsubscribe: () => void } | null>(null);
  const checkingSessionRef = useRef<boolean>(false);
  const supabase = useMemo(() => createClient(), []);

  // Function to store session data
  const storeSessionData = useCallback((data: CachedNavData) => {
    try {
      const sessionData = {
        ...data,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
      console.log("Stored session data:", sessionData);
    } catch (error) {
      console.error("Failed to store session data:", error);
    }
  }, []);

  // Function to clear session data
  const clearSessionData = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log("Cleared session data");
    } catch (error) {
      console.error("Failed to clear session data:", error);
    }
  }, []);

  const handleSignOut = useCallback(() => {
    console.log("Handling sign out");
    clearSessionData();
    setUserRole(null);
    setUserName(null);
    setUserEmail(null);
    setSessionChecked(true);
    setIsLoading(false);
    if (pathname !== "/sign-in" && pathname !== "/sign-up") {
      router.replace("/sign-in");
    }
  }, [clearSessionData, pathname, router]);

  const checkSession = useCallback(async () => {
    if (checkingSessionRef.current) {
      console.log("Session check already in progress");
      return;
    }

    console.log("Checking session...");
    checkingSessionRef.current = true;
    setIsLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Session error:", sessionError);
        handleSignOut();
        return;
      }

      if (!session) {
        console.log("No active session found");
        handleSignOut();
        return;
      }

      const { data: userData, error: dbError } = await supabase
        .from("users")
        .select("role, first_name, last_name")
        .eq("id", session.user.id)
        .single();

      if (dbError || !userData) {
        console.error("Failed to fetch user data:", dbError);
        handleSignOut();
        return;
      }

      const sessionData = {
        userRole: userData.role as Role,
        userName: `${userData.first_name} ${userData.last_name}`,
        userEmail: session.user.email || null,
      };

      console.log("Setting session data:", sessionData);
      setUserRole(sessionData.userRole);
      setUserName(sessionData.userName);
      setUserEmail(sessionData.userEmail);
      storeSessionData(sessionData);
      setSessionChecked(true);

      if (pathname === "/sign-in" || pathname === "/sign-up") {
        router.replace("/Dashboard");
      }
    } catch (error) {
      console.error("Session check failed:", error);
      handleSignOut();
    } finally {
      setIsLoading(false);
      checkingSessionRef.current = false;
    }
  }, [supabase, handleSignOut, pathname, router, storeSessionData]);

  const restoreSessionFromStorage = useCallback(async () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        console.log("No stored session found");
        return false;
      }

      const {
        userRole: storedRole,
        userName: storedName,
        userEmail: storedEmail,
        timestamp,
      } = JSON.parse(stored);

      if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
        console.log("Stored session expired");
        clearSessionData();
        return false;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.log("Stored session invalid - no active Supabase session");
        clearSessionData();
        return false;
      }

      console.log("Restored session from storage:", {
        storedRole,
        storedName,
        storedEmail,
      });
      setUserRole(storedRole);
      setUserName(storedName);
      setUserEmail(storedEmail);
      setSessionChecked(true);
      return true;
    } catch (error) {
      console.error("Failed to restore session from storage:", error);
      clearSessionData();
      return false;
    }
  }, [clearSessionData, supabase.auth]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let mounted = true;

    const setupAuth = async () => {
      console.log("Setting up auth...");

      if (authListenerRef.current) {
        authListenerRef.current.unsubscribe();
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("Auth state changed:", event, session?.user?.email);

        if (!mounted) return;

        if (event === "SIGNED_OUT") {
          console.log("User signed out");
          handleSignOut();
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          console.log("User signed in or token refreshed");
          // Don't await here - let it run in the background
          checkSession();
        }
      });

      authListenerRef.current = subscription;

      try {
        const restored = await restoreSessionFromStorage();
        console.log("Session restored from storage:", restored);

        if (!restored && mounted) {
          await checkSession();
        }
      } catch (error) {
        console.error("Failed to setup auth:", error);
        if (mounted) {
          handleSignOut();
        }
      }
    };

    setupAuth();

    return () => {
      mounted = false;
      if (authListenerRef.current) {
        authListenerRef.current.unsubscribe();
      }
    };
  }, [supabase, checkSession, handleSignOut, restoreSessionFromStorage]);

  const value = useMemo(
    () => ({
      userRole,
      userName,
      userEmail,
      isLoading,
      setUserRole,
      setUserName,
      setUserEmail,
    }),
    [userRole, userName, userEmail, isLoading]
  );

  if (!sessionChecked) {
    return null;
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
