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

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  console.log("UserProvider rendering");
  const router = useRouter();
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Supabase client
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    console.log("UserProvider effect running");
    let mounted = true;

    const checkSession = async () => {
      console.log("Checking session...");
      try {
        // First check if we have a session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        console.log("Session check result:", {
          session: !!session,
          sessionError,
          sessionDetails: session
            ? {
                userId: session.user?.id,
                email: session.user?.email,
              }
            : null,
        });

        if (sessionError) throw sessionError;

        if (!session) {
          console.log("No session found, clearing state");
          // Clear state if no session
          if (mounted) {
            setUserRole(null);
            setUserName(null);
            setUserEmail(null);
            setIsLoading(false); // Make sure to set loading to false
            if (
              pathname &&
              pathname !== "/sign-in" &&
              pathname !== "/sign-up"
            ) {
              console.log("Redirecting to sign-in");
              router.replace("/sign-in");
            }
          }
          return;
        }

        console.log("Session found, fetching user data");
        // Get user data from database
        const { data: userData, error: dbError } = await supabase
          .from("users")
          .select("role, first_name, last_name")
          .eq("id", session.user.id)
          .single();

        console.log("User data result:", { userData, dbError });

        if (!mounted) return;

        if (dbError) {
          console.error("Database error:", dbError);
          throw dbError;
        }

        if (!userData) {
          console.error("No user data found for ID:", session.user.id);
          throw new Error("User data not found");
        }

        // Update state with user data
        console.log("Setting user state:", userData);
        setUserRole(userData.role as Role);
        setUserName(`${userData.first_name} ${userData.last_name}`);
        setUserEmail(session.user.email || null);

        // If on auth pages and authenticated, redirect to dashboard
        if (pathname === "/sign-in" || pathname === "/sign-up") {
          console.log("Redirecting to dashboard");
          router.replace("/Dashboard");
        }
      } catch (error) {
        console.error("Session check error:", error);
        // Clear state on error
        if (mounted) {
          setUserRole(null);
          setUserName(null);
          setUserEmail(null);
          setIsLoading(false); // Make sure to set loading to false here too
          if (pathname !== "/sign-in" && pathname !== "/sign-up") {
            router.replace("/sign-in");
          }
        }
      } finally {
        if (mounted) {
          console.log("Setting loading to false");
          setIsLoading(false);
        }
      }
    };

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event);
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        console.log("User signed out");
        setUserRole(null);
        setUserName(null);
        setUserEmail(null);
        router.replace("/sign-in");
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        console.log("User signed in or token refreshed");
        if (!userRole) {
          // Only check session if we don't have user data
          setIsLoading(true);
          await checkSession();
        }
      }
    });

    // Initial check only if we don't have user data
    if (!userRole) {
      checkSession();
    }

    // Cleanup
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, router, pathname]);

  console.log("UserProvider state:", {
    userRole,
    userName,
    userEmail,
    isLoading,
  });

  return (
    <UserContext.Provider
      value={{
        userRole,
        userName,
        userEmail,
        isLoading,
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
