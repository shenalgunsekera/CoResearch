"use client";

import { useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PendingUser } from "@/lib/types";
import {
  subscribeToPendingUsers,
  updatePendingUserStatus,
} from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, Clock, Shield } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminDashboard() {
  const { user, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push("/dashboard");
    }
  }, [isLoading, isAdmin, router]);

  useEffect(() => {
    if (!user?.university?.name) return;
    setLoadingPending(true);
    const unsub = subscribeToPendingUsers(user.university.name, (data) => {
      setPendingUsers(data);
      setLoadingPending(false);
    });
    return unsub;
  }, [user?.university?.name]);

  if (isLoading || !isAdmin) return null;

  const handleApprove = async (pendingUser: PendingUser) => {
    if (actioningId) return;
    setActioningId(pendingUser.id);
    try {
      await updatePendingUserStatus(pendingUser.id, "approved", pendingUser.userId ?? pendingUser.id);
      toast.success("User approved successfully.");
    } catch {
      toast.error("Failed to approve user.");
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (pendingUser: PendingUser) => {
    if (actioningId) return;
    setActioningId(pendingUser.id);
    try {
      await updatePendingUserStatus(pendingUser.id, "rejected", pendingUser.userId ?? pendingUser.id);
      toast.message("User application rejected.");
    } catch {
      toast.error("Failed to reject user.");
    } finally {
      setActioningId(null);
    }
  };

  const pending = pendingUsers.filter((u) => u.status === "pending");
  const approved = pendingUsers.filter((u) => u.status === "approved");
  const rejected = pendingUsers.filter((u) => u.status === "rejected");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-bold">Admin Dashboard</h1>
                <p className="text-sm text-gray-500">{user?.university.name}</p>
              </div>
            </div>

            <Badge className="bg-blue-100 text-blue-800">
              <Shield className="w-3 h-3 mr-1" />
              Administrator
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Pending Approvals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{pending.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Approved Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{approved.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Rejected Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{rejected.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* User Management */}
        <Card>
          <CardHeader>
            <CardTitle>Student Verification</CardTitle>
            <CardDescription>
              Review and approve student registration requests for {user?.university.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pending">
              <TabsList data-tour-id="admin-verification-tabs">
                <TabsTrigger value="pending">
                  Pending ({pending.length})
                </TabsTrigger>
                <TabsTrigger value="approved">
                  Approved ({approved.length})
                </TabsTrigger>
                <TabsTrigger value="rejected">
                  Rejected ({rejected.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="space-y-4 mt-6">
                {loadingPending ? (
                  <div className="text-center py-12 text-sm text-gray-600">
                    Loading verification queue...
                  </div>
                ) : pending.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No pending applications
                    </h3>
                    <p className="text-gray-600">
                      All applications have been reviewed
                    </p>
                  </div>
                ) : (
                  pending.map((user) => (
                    <Card key={user.id} className="border-2">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-1">{user.name}</h3>
                            <p className="text-sm text-gray-600 mb-3">{user.email}</p>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-xs text-gray-500">Student ID</p>
                                <p className="font-medium">{user.studentId}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Program</p>
                                <p className="font-medium">{user.program}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Year</p>
                                <p className="font-medium">Year {user.year}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Submitted</p>
                                <p className="font-medium">
                                  {new Date(user.submittedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            <div className="mb-4">
                              <p className="text-xs text-gray-500 mb-2">Research Interests</p>
                              <div className="flex flex-wrap gap-2">
                                {user.interests.map((interest, idx) => (
                                  <Badge key={idx} variant="outline">
                                    {interest}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 ml-4 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-600 hover:bg-green-50"
                              disabled={!!actioningId}
                              onClick={() => handleApprove(user)}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              {actioningId === user.id ? "Approving…" : "Approve"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-600 hover:bg-red-50"
                              disabled={!!actioningId}
                              onClick={() => handleReject(user)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              {actioningId === user.id ? "Rejecting…" : "Reject"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="approved" className="space-y-4 mt-6">
                {approved.map((user) => (
                  <Card key={user.id} className="border-green-200 bg-green-50/50">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold">{user.name}</h3>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">
                          <Check className="w-3 h-3 mr-1" />
                          Approved
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="rejected" className="space-y-4 mt-6">
                {rejected.map((user) => (
                  <Card key={user.id} className="border-red-200 bg-red-50/50">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold">{user.name}</h3>
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </div>
                        <Badge className="bg-red-100 text-red-800">
                          <X className="w-3 h-3 mr-1" />
                          Rejected
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}



