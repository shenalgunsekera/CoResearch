"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const ALLOWED_FOR_UNVERIFIED = new Set(["/verification-status"]);

export function VerificationGate() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading || !pathname) return;
    if (!user) return;

    if (user.role === "student" && !user.verified) {
      if (!ALLOWED_FOR_UNVERIFIED.has(pathname)) {
        router.push("/verification-status");
      }
      return;
    }

    if (pathname === "/verification-status") {
      router.push("/dashboard");
    }
  }, [isLoading, pathname, router, user]);

  return null;
}

