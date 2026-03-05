"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getUniversities } from "@/lib/firestore";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { BookOpen, CheckCircle2 } from "lucide-react";
import type { University } from "@/lib/types";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    universityId: "",
    studentId: "",
    program: "",
    year: "",
    interests: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [universities, setUniversities] = useState<University[]>([]);
  const [universitiesLoading, setUniversitiesLoading] = useState(true);
  const [universitiesError, setUniversitiesError] = useState<string | null>(null);
  const { register, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push("/dashboard");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    const loadUniversities = async () => {
      setUniversitiesLoading(true);
      setUniversitiesError(null);
      try {
        const data = await getUniversities();
        setUniversities(data);
        if (data.length === 0) {
          setUniversitiesError("No universities found. Ask admin to seed the universities collection.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load universities.";
        setUniversitiesError(message);
        toast.error(message);
      } finally {
        setUniversitiesLoading(false);
      }
    };

    loadUniversities();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await register({
        ...formData,
        year: parseInt(formData.year),
        interests: formData.interests.split(",").map((i) => i.trim()),
      });
      setSuccess(true);
      toast.success("Registration submitted successfully!");
      setTimeout(() => router.push("/"), 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-16 h-16 text-green-600" />
            </div>
            <CardTitle>Registration Submitted!</CardTitle>
            <CardDescription>
              Your application has been sent to your university admin for verification.
              You&apos;ll receive an email once approved.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-gray-600">
            <p>Redirecting to login page...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <BookOpen className="w-10 h-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">CoResearch</h1>
          </div>
          <p className="text-gray-600">Create Your Research Account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Student Registration</CardTitle>
            <CardDescription>
              Register with your university credentials. Your account will be verified by your
              institution&apos;s admin.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">University Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="student@university.edu"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="university">University</Label>
                <Select
                  value={formData.universityId}
                  onValueChange={(value) => setFormData({ ...formData, universityId: value })}
                  disabled={universitiesLoading || universities.length === 0}
                  required
                >
                  <SelectTrigger id="university">
                    <SelectValue placeholder={universitiesLoading ? "Loading universities..." : "Select your university"} />
                  </SelectTrigger>
                  <SelectContent>
                    {universities.map((uni) => (
                      <SelectItem key={uni.id} value={uni.id}>
                        {uni.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {universitiesError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    <p>{universitiesError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 px-2 text-xs"
                      onClick={async () => {
                        setUniversitiesLoading(true);
                        setUniversitiesError(null);
                        try {
                          const data = await getUniversities();
                          setUniversities(data);
                          if (data.length === 0) {
                            setUniversitiesError("No universities found. Ask admin to seed the universities collection.");
                          }
                        } catch (error) {
                          const message =
                            error instanceof Error ? error.message : "Failed to load universities.";
                          setUniversitiesError(message);
                          toast.error(message);
                        } finally {
                          setUniversitiesLoading(false);
                        }
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="studentId">Student ID</Label>
                  <Input
                    id="studentId"
                    placeholder="ST123456"
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year of Study</Label>
                  <Select
                    value={formData.year}
                    onValueChange={(value) => setFormData({ ...formData, year: value })}
                    required
                  >
                    <SelectTrigger id="year">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          Year {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="program">Program of Study</Label>
                <Input
                  id="program"
                  placeholder="e.g., BSc Computer Science"
                  value={formData.program}
                  onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interests">Research Interests</Label>
                <Input
                  id="interests"
                  placeholder="e.g., Machine Learning, Data Science, AI"
                  value={formData.interests}
                  onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500">Separate multiple interests with commas</p>
              </div>

              <div className="bg-amber-50 p-3 rounded-md text-sm">
                <p className="font-semibold mb-1">Verification Required</p>
                <p className="text-gray-700">
                  Your registration will be reviewed by your university admin before you can access
                  the platform.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading || universitiesLoading || universities.length === 0}>
                {loading ? "Submitting..." : "Submit Registration"}
              </Button>
              <div className="text-center text-sm text-gray-600">
                Already have an account?{" "}
                <Link href="/" className="text-blue-600 hover:underline">
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}



