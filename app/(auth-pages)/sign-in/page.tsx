"use client";
import { Suspense } from "react";
import LoginForm from "./login-form";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
