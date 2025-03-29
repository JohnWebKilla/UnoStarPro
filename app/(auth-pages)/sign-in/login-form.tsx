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
import { FadeIn } from "@/components/ui/animations";
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
    <FadeIn direction="up" duration={0.3}>
      <FormMessage message={searchParamsMessage} />
    </FadeIn>
  ) : null;
}

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [showAtSuggestion, setShowAtSuggestion] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUserRole, setUserName, setUserEmail } = useUser();
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const emailDomains = ["gmail.com", "unostarsolutions.com"];

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle arrow keys, enter, and escape
    if (showAtSuggestion || showEmailSuggestions) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            showAtSuggestion ? 0 : Math.min(prev + 1, emailDomains.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, -1));
          break;
        case "Enter":
          e.preventDefault();
          if (showAtSuggestion && selectedIndex === 0) {
            addAtSymbol();
          } else if (showEmailSuggestions && selectedIndex >= 0) {
            selectEmailDomain(emailDomains[selectedIndex]);
          }
          break;
        case "Escape":
          setShowAtSuggestion(false);
          setShowEmailSuggestions(false);
          setSelectedIndex(-1);
          break;
        case "@":
          if (!emailInput.includes("@")) {
            addAtSymbol();
          }
          break;
      }
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmailInput(value);
    setSelectedIndex(-1); // Reset selection when input changes

    // Show @ suggestion if there's text but no @ symbol yet
    setShowAtSuggestion(value.length > 0 && !value.includes("@"));

    // Show domain suggestions if there's an @ but no dot after it
    setShowEmailSuggestions(
      value.includes("@") && !value.includes(".", value.indexOf("@"))
    );
  };

  const selectEmailDomain = (domain: string) => {
    const baseEmail = emailInput.split("@")[0];
    setEmailInput(`${baseEmail}@${domain}`);
    setShowEmailSuggestions(false);
  };

  const addAtSymbol = () => {
    setEmailInput(`${emailInput}@`);
    setShowAtSuggestion(false);
    setShowEmailSuggestions(true);
  };
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setLoadingMessage("Authenticating...");
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

      setLoadingMessage("Preparing your workspace...");

      // Initialize cache manager
      const cacheManager = new ClientCacheManager(result.userData.role);

      try {
        // Start prefetching and wait for completion
        setLoadingMessage("Caching your data...");
        await cacheManager.prefetchAllData();

        // Verify cache is populated with required data
        let retries = 0;
        const maxRetries = 5;
        const retryDelay = 1000; // 1 second
        let isCacheReady = false;

        while (retries < maxRetries && !isCacheReady) {
          setLoadingMessage(
            `Verifying data cache... (Attempt ${retries + 1}/${maxRetries})`
          );

          // Check if cache is complete
          const isComplete = await cacheManager.isPrefetchComplete();
          if (!isComplete) {
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            retries++;
            continue;
          }

          // Verify essential data is cached
          try {
            const cacheStatus = await cacheManager.verifyCacheStatus();
            if (cacheStatus.isReady) {
              isCacheReady = true;
              break;
            }
          } catch (verifyError) {
            console.error("Cache verification error:", verifyError);
          }

          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          retries++;
        }

        if (!isCacheReady) {
          console.warn(
            "Cache verification incomplete, proceeding with caution"
          );
        }

        setLoadingMessage("Redirecting to your dashboard...");

        // Check if there's a redirect URL in the search params
        const redirectTo = searchParams.get("redirectTo");

        // Navigate to the redirect URL or dashboard
        if (redirectTo && redirectTo.startsWith("/(protected)")) {
          router.replace(redirectTo);
        } else {
          router.replace(result.dashboardUrl);
        }
      } catch (cacheError) {
        console.error("Cache preparation error:", cacheError);
        // Continue with navigation even if caching fails
        setLoadingMessage("Proceeding with limited offline capability...");
        router.replace(result.dashboardUrl);
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <InitialLoadingScreen message={loadingMessage} />;
  }

  return (
    <div className="flex w-full items-center justify-center min-h-screen p-4">
      <FadeIn
        direction="up"
        duration={0.5}
        className="w-full max-w-lg p-8 space-y-8 bg-background rounded-lg shadow-lg"
      >
        <form onSubmit={handleSubmit}>
          <FadeIn delay={0.2} duration={0.5}>
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
          </FadeIn>

          <FadeIn delay={0.4} duration={0.5} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={emailInput}
                  onChange={handleEmailChange}
                  onKeyDown={handleEmailKeyDown}
                  placeholder="Enter your email"
                  required
                  className="w-full"
                  autoComplete="email"
                />
                {showAtSuggestion && (
                  <div className="absolute w-full mt-1 p-1 bg-background border rounded-md shadow-lg z-10">
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 rounded-sm ${
                        selectedIndex === 0 ? "bg-muted" : "hover:bg-muted"
                      }`}
                      onClick={addAtSymbol}
                    >
                      Add @ symbol
                    </button>
                  </div>
                )}
                {showEmailSuggestions && (
                  <div className="absolute w-full mt-1 p-1 bg-background border rounded-md shadow-lg z-10">
                    {emailDomains.map((domain, index) => (
                      <button
                        key={domain}
                        type="button"
                        className={`w-full text-left px-3 py-2 rounded-sm ${
                          selectedIndex === index
                            ? "bg-muted"
                            : "hover:bg-muted"
                        }`}
                        onClick={() => selectEmailDomain(domain)}
                      >
                        {domain}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full pr-10"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && <FormMessage message={{ error }} />}
            <SearchParamsMessage />

            <SubmitButton pendingText="Signing in...">Sign in</SubmitButton>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/sign-up" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </FadeIn>
        </form>
      </FadeIn>
    </div>
  );
}
