"use client";
import { signUpAction } from "@/app/Actions/auth-actions";
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
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import type { E164Number } from "libphonenumber-js/types";
import { createClient } from "@/utils/supabase/client";

export default function SignUp() {
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<E164Number | undefined>(
    undefined
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(
    null
  );

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement> | File
  ) => {
    let file: File | undefined;
    if (event instanceof File) {
      file = event;
    } else {
      file = event.target.files?.[0];
    }

    if (file) {
      setAvatarFile(file);
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);

      // Immediately upload the avatar when selected
      setIsUploading(true);
      const avatarUrl = await handleAvatarUpload(file);
      if (avatarUrl) {
        // Store the uploaded URL to use during form submission
        setUploadedAvatarUrl(avatarUrl);
      }
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    const fileInput = document.getElementById("avatar") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleAvatarUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const uniqueID = Date.now().toString();
      const fileName = `${uniqueID}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(`public/${fileName}`, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        setErrorMessage(uploadError.message);
        return null;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(`public/${fileName}`);

      return publicUrl;
    } catch (error) {
      setErrorMessage("Failed to upload avatar");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // Update the handleSubmit function
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);

    try {
      if (phoneNumber) {
        formData.append("phone_number", phoneNumber.toString());
      }

      // Use the already uploaded avatar URL
      if (uploadedAvatarUrl) {
        formData.append("avatar", uploadedAvatarUrl);
      }

      const result = await handleSignUp(formData);

      if (isErrorResult(result)) {
        setErrorMessage(result.error);
        return;
      }

      console.log("Sign-up successful");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (formData: FormData) => {
    const result = await signUpAction(formData);

    if (typeof result === "string") {
      if (result.startsWith("error:")) {
        const errorMessage = result.split(":")[1];
        return { error: errorMessage };
      }
    }

    return result;
  };

  function isErrorResult(result: any): result is { error: string } {
    return typeof result === "object" && result !== null && "error" in result;
  }

  return (
    <div className="flex w-full items-center justify-center min-h-screen  p-4">
      <motion.form
        className="w-full max-w-md p-8 space-y-6 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        onSubmit={handleSubmit}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center"
        >
          <div className="flex flex-col items-center justify-center mb-6">
            <Image
              src="/logo.webp"
              alt="UnoStar Logo"
              width={60}
              height={60}
              className="mb-4"
            />
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              Create Account
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Join UnoStar and get started today
            </p>
          </div>
          <div className="absolute top-4 right-4">
            <ThemeSwitcher />
          </div>
        </motion.div>

        <div className="space-y-2">
          <Label htmlFor="avatar">Profile Picture</Label>
          <div className="flex flex-col items-center gap-4">
            <div
              className={`relative w-32 h-32 ${!avatarPreview ? "border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer group" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith("image/")) {
                  handleAvatarChange(file);
                }
              }}
              onClick={() => {
                if (!avatarPreview) {
                  document.getElementById("avatar")?.click();
                }
              }}
            >
              {avatarPreview ? (
                <div className="relative w-32 h-32">
                  <Image
                    src={avatarPreview}
                    alt="Avatar preview"
                    width={128}
                    height={128}
                    className="rounded-full object-cover w-full h-full ring-2 ring-offset-2 ring-blue-500 dark:ring-blue-400"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveAvatar();
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition-colors"
                    aria-label="Remove avatar"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-500 border-t-transparent"></div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <svg
                    className="mx-auto h-8 w-8 text-gray-400 group-hover:text-blue-500 dark:text-gray-600 dark:group-hover:text-blue-400 transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Drag & drop or click to upload
                  </p>
                </div>
              )}
            </div>
            <Input
              id="avatar"
              name="avatar"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="sr-only"
              disabled={isUploading || isSubmitting}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_name" className="text-sm font-medium">
              First Name
            </Label>
            <Input
              id="first_name"
              name="first_name"
              placeholder="Your first name"
              type="text"
              required
              className="w-full transition-all duration-200 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name" className="text-sm font-medium">
              Last Name
            </Label>
            <Input
              id="last_name"
              name="last_name"
              placeholder="Your last name"
              type="text"
              required
              className="w-full transition-all duration-200 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

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
          <Label htmlFor="phone">Phone Number</Label>
          <div className="relative">
            <PhoneInput
              international
              defaultCountry="US"
              value={phoneNumber}
              onChange={(value: E164Number | undefined) =>
                setPhoneNumber(value)
              }
              className="w-full p-2 border rounded-md bg-background text-foreground transition-colors focus-within:ring-2 focus-within:ring-blue-500 hover:border-gray-400 dark:hover:border-gray-600"
              style={{
                "--PhoneInputCountry": "4rem",

                "--PhoneInput-color--focus": "transparent",
                "--PhoneInputInternationalIconPhone": "transparent",
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Create a password"
              required
              className="w-full pr-10"
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
          pendingText={
            isUploading ? "Uploading image..." : "Creating your account..."
          }
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-2 rounded-lg transition-all duration-200 transform hover:scale-[1.02]"
          disabled={isUploading || isSubmitting}
        >
          Create Account
        </SubmitButton>

        <p className="text-sm text-center text-gray-600 dark:text-gray-400">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>

        {errorMessage && (
          <FormMessage
            message={{
              error: errorMessage,
            }}
          />
        )}
      </motion.form>
    </div>
  );
}
