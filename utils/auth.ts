"use client";

import { signOutAction } from "@/app/Actions/auth-actions";

export async function handleSignOut() {
  try {
    const result = await signOutAction();

    if (result.error) {
      console.error("Sign-out error:", result.error);
      return;
    }

    // Clear local storage
    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");

    // Redirect to sign-in page
    window.location.href = "/sign-in";
  } catch (error) {
    console.error("Error during sign out:", error);
  }
}
