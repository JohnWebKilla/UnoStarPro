"use client";
import { signInAction } from "@/app/Actions/auth-actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { motion } from "framer-motion";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Image from "next/image";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { getDashboardForRole } from "@/utils/protected";
import { useUser } from "@/contexts/UserContext";
import { type Role } from "@/utils/protected";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

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
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { setUserRole, setUserName, setUserEmail } = useUser();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const result = await signInAction(formData);

      if (!result) {
        setErrorMessage("An unexpected error occurred");
        return;
      }

      if ("error" in result) {
        setErrorMessage(result.error);
        setIsLoading(false);
        return;
      }

      // Set the user context with the returned data
      setUserRole(result.user.role as Role);
      setUserName(result.user.name);
      setUserEmail(result.user.email);

      // Use the dashboard URL from the response
      if (result.dashboardUrl) {
        window.location.href = result.dashboardUrl;
      } else {
        setErrorMessage("Unable to determine appropriate dashboard");
        setIsLoading(false);
      }
    } catch (error) {
      setErrorMessage("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <>
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

            {errorMessage && (
              <FormMessage
                message={{
                  error: errorMessage,
                }}
              />
            )}
          </motion.div>
        </motion.form>
      </div>
      {isLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <img src="/Data Loading.gif" alt="Loading" className="h-96 w-96" />
          </div>
        </div>
      )}
    </>
  );
}
