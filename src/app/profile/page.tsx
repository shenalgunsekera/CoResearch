"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, Lock, GraduationCap, BookOpen, Tag, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { user, isLoading, changePassword, updateProfile } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(user?.name ?? "");
  const [program, setProgram] = useState(user?.program ?? "");
  const [year, setYear] = useState(String(user?.year ?? "1"));
  const [interests, setInterests] = useState(user?.interests?.join(", ") ?? "");
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  if (isLoading || !user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name cannot be empty.");
    setProfileSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        program: program.trim(),
        year: parseInt(year, 10),
        interests: interests.split(",").map((i) => i.trim()).filter(Boolean),
      });
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) return toast.error("Enter your current password.");
    if (newPassword.length < 6) return toast.error("New password must be at least 6 characters.");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match.");
    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to change password.";
      if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        toast.error("Current password is incorrect.");
      } else {
        toast.error(msg);
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-4 px-4 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        {/* Profile summary card */}
        <Card>
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6 sm:flex-row sm:items-start sm:gap-6">
            <Avatar className="h-20 w-20 text-2xl">
              <AvatarFallback className="bg-blue-100 text-blue-700 text-2xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left">
              <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
              <p className="text-gray-500">{user.email}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge variant="outline" className="flex items-center gap-1">
                  <GraduationCap className="h-3 w-3" />
                  {user.university.name}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {user.program || "—"}
                </Badge>
                {user.role === "admin" && (
                  <Badge className="bg-blue-100 text-blue-800">Administrator</Badge>
                )}
                {user.role === "student" && user.verified && (
                  <Badge className="bg-green-100 text-green-800">Verified</Badge>
                )}
              </div>
              {Array.isArray(user.interests) && user.interests.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                  {user.interests.slice(0, 6).map((i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      <Tag className="h-2.5 w-2.5" />
                      {i}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1">
              <User className="mr-2 h-4 w-4" />
              Edit Profile
            </TabsTrigger>
            <TabsTrigger value="password" className="flex-1">
              <Lock className="mr-2 h-4 w-4" />
              Change Password
            </TabsTrigger>
          </TabsList>

          {/* Edit Profile Tab */}
          <TabsContent value="profile" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your name, program, and research interests.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSaveProfile}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="program">Program of Study</Label>
                      <Input
                        id="program"
                        value={program}
                        onChange={(e) => setProgram(e.target.value)}
                        placeholder="e.g., BSc Computer Science"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year">Year of Study</Label>
                      <Select value={year} onValueChange={setYear}>
                        <SelectTrigger id="year">
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((y) => (
                            <SelectItem key={y} value={String(y)}>
                              Year {y}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="interests">Research Interests</Label>
                    <Input
                      id="interests"
                      value={interests}
                      onChange={(e) => setInterests(e.target.value)}
                      placeholder="e.g., Machine Learning, Data Science, AI"
                    />
                    <p className="text-xs text-gray-500">Separate multiple interests with commas.</p>
                  </div>

                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                    <p className="font-medium text-gray-700">Read-only fields</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <span className="text-xs text-gray-500">Email</span>
                        <p className="font-medium text-gray-800">{user.email}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">University</span>
                        <p className="font-medium text-gray-800">{user.university.name}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Student ID</span>
                        <p className="font-medium text-gray-800">{user.studentId || "—"}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Role</span>
                        <p className="font-medium text-gray-800 capitalize">{user.role}</p>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={profileSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {profileSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </CardContent>
              </form>
            </Card>
          </TabsContent>

          {/* Change Password Tab */}
          <TabsContent value="password" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Enter your current password to set a new one. Minimum 6 characters.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleChangePassword}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrent ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Your current password"
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowCurrent((v) => !v)}
                        tabIndex={-1}
                      >
                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowNew((v) => !v)}
                        tabIndex={-1}
                      >
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowConfirm((v) => !v)}
                        tabIndex={-1}
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-sm text-red-600">Passwords do not match.</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      passwordSaving ||
                      !currentPassword ||
                      newPassword.length < 6 ||
                      newPassword !== confirmPassword
                    }
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    {passwordSaving ? "Changing..." : "Change Password"}
                  </Button>
                </CardContent>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
