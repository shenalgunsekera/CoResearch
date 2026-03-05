"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"student" | "university">("student");

  const { login, user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/dashboard");
    }
  }, [isLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast.success("Login successful!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Co<span className="text-[#5170ff]">Research</span>
          </h1>

          <p className="text-gray-600">
            Collaborative Research Platform for University Students
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            {/* Role Tabs */}
            <div className="grid grid-cols-2 rounded-lg border border-gray-200 bg-gray-100 p-1 text-sm">
              <button
                type="button"
                onClick={() => setRole("student")}
                className={`rounded-md py-2 font-medium transition ${
                  role === "student"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Student
              </button>

              <button
                type="button"
                onClick={() => setRole("university")}
                className={`rounded-md py-2 font-medium transition ${
                  role === "university"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                University
              </button>
            </div>

            <CardTitle>
              {role === "student"
                ? "Student Sign In"
                : "University Admin Access"}
            </CardTitle>

            <CardDescription>
              {role === "student"
                ? "Log in using your university-issued email address."
                : "Institution administrators can log in or register to verify students and manage institutional research."}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  {role === "student"
                    ? "University Email"
                    : "Institution Admin Email"}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={
                    role === "student"
                      ? "student@university.edu"
                      : "admin@university.edu"
                  }
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {/* University explanation */}
              {role === "university" && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <p className="mb-1 font-semibold">
                    University Administrator Access
                  </p>
                  <p>
                    Approved institution administrators can verify student
                    registrations, manage access permissions, and oversee
                    research projects associated with their university.
                  </p>
                </div>
              )}

            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Continue"}
              </Button>

              <div className="text-center text-sm text-gray-600">
                {role === "student" ? (
                  <>
                    New student?{" "}
                    <Link href="/register"
                      className="text-blue-600 hover:underline"
                    >
                      Register
                    </Link>
                  </>
                ) : (
                  <>
                   
                  </>
                )}
              </div>
            </CardFooter>
          </form>
        </Card>

        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <GraduationCap className="w-4 h-4" />
            <span>Secure, Institution-Verified Access</span>
          </div>
        </div>
      </div>
    </div>
  );
}



