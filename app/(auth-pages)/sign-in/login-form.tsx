"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/app/Actions/auth-actions";
import { Eye, EyeOff } from "lucide-react";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { motion } from "framer-motion";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { getDashboardForRole } from "@/utils/protected";
import { useUser } from "@/contexts/UserContext";
import type { Role } from "@/types/role";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { InitialLoadingScreen } from "@/components/initial-loading-screen";
import { ClientCacheManager } from "@/lib/client-cache-manager";

interface UserData {
  role: Role;
  first_name: string;
  last_name: string;
}

interface SignInSuccess {
  success: true;
  userData: UserData;
  dashboardUrl: string;
}

interface SignInError {
  success: false;
  error: string;
}

type SignInResult = SignInSuccess | SignInError;

function SearchParamsMessage() {
  const searchParams = useSearchParams();
  const searchParamsMessage: Message = {
    error: Array.from(searchParams.entries())
      .map(([key, value]) => `${key}: ${value}`)
      .join(", "),
  };

  return searchParams && Object.keys(searchParams).length > 0 ? (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <FormMessage message={searchParamsMessage} />
    </motion.div>
  ) : null;
}

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { setUserRole, setUserName, setUserEmail } = useUser();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const result = (await signIn(email, password)) as SignInResult;

      if (!result.success) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      // Update user context
      setUserRole(result.userData.role);
      setUserName(`${result.userData.first_name} ${result.userData.last_name}`);
      setUserEmail(email);

      // Store user data in localStorage
      localStorage.setItem("userData", JSON.stringify(result.userData));

      // Initialize cache manager and prefetch data before navigation
      const cacheManager = new ClientCacheManager(result.userData.role);
      await cacheManager.prefetchAllData();

      // Navigate to dashboard
      router.replace(result.dashboardUrl);
    } catch (error) {
      console.error("Login error:", error);
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <InitialLoadingScreen />;
  }

  return (
    <div className="flex w-full items-center justify-center min-h-screen p-4">
      <motion.form
        className="w-full max-w-lg p-8 space-y-8 bg-background rounded-lg shadow-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        onSubmit={handleSubmit}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center">
              <Image
                src="/logo.webp"
                alt="UnoStar Logo"
                width={50}
                height={50}
                className="mr-2"
              />
              <div>
                <h1 className="text-2xl font-bold">UnoStar</h1>
                <h2 className="text-xl">Sign in</h2>
              </div>
            </div>
            <ThemeSwitcher />
          </div>
        </motion.div>

        <motion.div
          className="space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              className="w-full"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="password">Password</Label>
              <Link
                className="text-xs text-primary hover:underline"
                href="/forgot-password"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Your password"
                required
                className="w-full pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-500" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-500" />
                )}
              </button>
            </div>
          </div>

          <SubmitButton
            pendingText="Signing In..."
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Signing In..." : "Sign in"}
          </SubmitButton>

          <SearchParamsMessage />

          {error && (
            <FormMessage
              message={{
                error: error,
              }}
            />
          )}
        </motion.div>
      </motion.form>
    </div>
  );
}
