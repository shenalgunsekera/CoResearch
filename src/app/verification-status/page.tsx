"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeCheck, Clock3, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function VerificationStatusPage() {
  const { user, isLoading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push("/");
      return;
    }
    if (user.role !== "student" || user.verified) {
      router.push("/dashboard");
    }
  }, [isLoading, router, user]);

  if (isLoading || !user) return null;

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const profile = await refreshUser();
      if (profile?.verified) {
        toast.success("Your account is now verified.");
        router.push("/dashboard");
      } else {
        toast.message("Still pending approval.");
      }
    } catch {
      toast.error("Could not refresh verification status.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-10">
      <div className="pointer-events-none absolute -top-40 -left-24 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-12 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="mx-auto max-w-2xl">
        <Card className="border-slate-700/60 bg-slate-900/80 text-white backdrop-blur">
          <CardHeader className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-500/20 p-2">
                <ShieldCheck className="h-6 w-6 text-blue-300" />
              </div>
              <div>
                <CardTitle className="text-2xl">Status Being Verified</CardTitle>
                <CardDescription className="text-slate-300">
                  Your student account is under university review.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-slate-700 bg-slate-800/70 p-4">
              <p className="text-sm text-slate-200">
                <span className="font-semibold">{user.name}</span> ({user.email})
              </p>
              <p className="mt-1 text-sm text-slate-300">{user.university.name}</p>
              <div className="mt-3 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-amber-300" />
                <span className="text-sm text-amber-200">Pending admin approval</span>
              </div>
            </div>

            <div className="rounded-lg border border-blue-400/30 bg-blue-500/10 p-4">
              <div className="flex items-center gap-2 text-blue-200">
                <BadgeCheck className="h-4 w-4" />
                <p className="text-sm font-medium">What happens next</p>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                Your university administrator will verify your details. Once approved, you can access the full platform instantly.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleCheckStatus} disabled={checking}>
                {checking ? "Checking..." : "Check Status"}
              </Button>
              <Button variant="outline" className="border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800" onClick={logout}>
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
