"use client";

import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";
import { forgotPasswordAction } from "@/app/Actions/auth-actions";
import { motion } from "framer-motion";
import Image from "next/image";
import { ThemeSwitcher } from "@/components/theme-switcher";

type MessageType = {
  type: "error" | "success";
  content: string;
};

export default function ForgotPassword() {
  const [message, setMessage] = useState<MessageType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const formData = new FormData(event.currentTarget);
      const result = await forgotPasswordAction(formData);

      if (typeof result === "string" && result.startsWith("error:")) {
        setMessage({ type: "error", content: result.split(":")[1] });
      } else {
        setMessage({
          type: "success",
          content: "Check your email for password reset instructions.",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        content: "An unexpected error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full items-center justify-center min-h-screen p-4">
      <motion.div
        className="w-full max-w-lg p-8 space-y-8 bg-background rounded-lg shadow-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
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
                <h2 className="text-xl">Reset Password</h2>
              </div>
            </div>
            <ThemeSwitcher />
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              className="w-full"
            />
          </div>

          <SubmitButton
            pendingText="Sending Reset Link..."
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Sending Reset Link..." : "Send Reset Link"}
          </SubmitButton>

          {message && (
            <FormMessage
              message={{
                message: message.content,
              }}
            />
          )}

          <div className="text-center">
            <Link
              href="/sign-in"
              className="text-sm text-primary hover:underline"
            >
              Back to Sign In
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
