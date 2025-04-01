"use client";
import { Suspense } from "react";
import LoginForm from "./login-form";
import AlreadySignedIn from "./already-signed-in";
import { useUser } from "@/contexts/UserContext";

export default function SignInPage() {
  const { userRole } = useUser();

  return (
    <Suspense fallback={null}>
      {userRole ? <AlreadySignedIn /> : <LoginForm />}
    </Suspense>
  );
}
