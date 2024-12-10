"use client";
import { signInAction } from "@/app/actions";
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

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const handleSignIn = async (formData: FormData) => {
    const result = await signInAction(formData);

    // Check if the result is a string (indicating an error message)
    if (typeof result === "string") {
      if (result.startsWith("error:")) {
        const errorMessage = result.split(":")[1];
        return { error: errorMessage };
      }
    }

    // If the result is not a string, assume it's a redirect
    return result;
  };

  const signInWrapper = async (formData: FormData) => {
    const result = await handleSignIn(formData);
    return result;
  };

  const searchParamsMessage: Message = {
    error: Array.from(searchParams.entries())
      .map(([key, value]) => `${key}: ${value}`)
      .join(", "),
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const result = await signInWrapper(formData);

    // Check if the result is an object with an error property
    if (isErrorResult(result)) {
      // Set the error message in the state
      setErrorMessage(result.error);
      return;
    }

    // Handle successful sign-in
    console.log("Sign-in successful");
    setErrorMessage(null); // Clear the error message
  };

  // Type guard function to check if the result is an object with an error property
  function isErrorResult(result: any): result is { error: string } {
    return typeof result === "object" && result !== null && "error" in result;
  }

  return (
    <div className="flex w-full items-center justify-center min-h-screen p-4 ">
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

          <SubmitButton pendingText="Signing In..." className="w-full">
            Sign in
          </SubmitButton>

          {searchParams && Object.keys(searchParams).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <FormMessage message={searchParamsMessage} />
            </motion.div>
          )}

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
  );
}
