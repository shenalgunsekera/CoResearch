"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Document } from "@/lib/types";
import { deleteDocumentById, subscribeToDocumentsForUser } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  Search,
  FileText,
  Users,
  LogOut,
  Settings,
  Compass,
  Trash2,
  Rocket,
  Sparkles,
  User,
  Menu,
  X as XIcon,
  GitBranch,
  GitMerge,
  Clock,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { completeProductTourForUser, startProductTour } from "@/components/product-tour";

const ONBOARDING_STORAGE_KEY = "coresearch:onboarding:v2";

export default function DashboardPage() {
  const { user, logout, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showGuideNudge, setShowGuideNudge] = useState(false);
  const [guideStateReady, setGuideStateReady] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    setLoadingDocs(true);
    const unsub = subscribeToDocumentsForUser(user.id, (data) => {
      setDocuments(data);
      setLoadingDocs(false);
    });
    return unsub;
  }, [user?.id]);

  useEffect(() => {
    if (!user || loadingDocs) return;

    const storageKey = `${ONBOARDING_STORAGE_KEY}:${user.id}`;
    const completed = localStorage.getItem(storageKey) === "completed";
    const shouldNudge = !completed && documents.length === 0;

    setShowGuideNudge(shouldNudge);
    setGuideStateReady(true);
  }, [documents.length, loadingDocs, user]);

  if (isLoading || !user) {
    return null;
  }

  const userDocuments = documents;

  const filteredDocuments = userDocuments.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStageColor = (stage: Document["stage"]) => {
    switch (stage) {
      case "draft":     return "bg-gray-100 text-gray-700";
      case "review":    return "bg-blue-100 text-blue-800";
      case "published": return "bg-green-100 text-green-800";
    }
  };

  const getMergeStatusColor = (status: Document["mergeRequestStatus"]) => {
    switch (status) {
      case "pending":  return "bg-amber-100 text-amber-800";
      case "merged":   return "bg-green-100 text-green-800";
      case "rejected": return "bg-red-100 text-red-700";
      default:         return null;
    }
  };

  // Shared card used across all three tabs
  const DocCard = ({ doc }: { doc: Document }) => {
    const isBranch = !!doc.parentDocumentId;
    const versionLabel = doc.currentVersion > 0 ? `v${doc.currentVersion}` : "Draft";
    const mergeColor = getMergeStatusColor(doc.mergeRequestStatus);
    const isOwner = doc.ownerId === user.id;

    return (
      <Card
        className="group hover:shadow-md transition-all cursor-pointer border border-gray-200"
        onClick={() => router.push(`/document/${doc.id}`)}
      >
        <CardContent className="p-4">
          {/* Top row: title + stage badge + delete */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                {isBranch && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 shrink-0">
                    <GitBranch className="h-2.5 w-2.5" />Branch
                  </span>
                )}
                {doc.mergeRequestStatus && mergeColor && (
                  <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${mergeColor}`}>
                    <GitMerge className="h-2.5 w-2.5" />
                    {doc.mergeRequestStatus.charAt(0).toUpperCase() + doc.mergeRequestStatus.slice(1)}
                  </span>
                )}
              </div>
              {/* Title — truncates cleanly */}
              <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 wrap-break-word">
                {doc.title}
              </h3>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Badge className={`text-xs ${getStageColor(doc.stage)}`}>
                {doc.stage.charAt(0).toUpperCase() + doc.stage.slice(1)}
              </Badge>
              {isOwner && (
                <button
                  type="button"
                  title="Delete project"
                  className="rounded p-1 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                  onClick={(e) => openDeleteDialog(doc, e)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Bottom row: meta */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(doc.updatedAt).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {doc.collaborators.length}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {versionLabel}
            </span>
            {!isOwner && (
              <span className="text-gray-400">by {doc.ownerName}</span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const openDeleteDialog = (doc: Document, event: React.MouseEvent) => {
    event.stopPropagation();
    if (doc.ownerId !== user.id) {
      toast.error("Only the owner can delete this project.");
      return;
    }
    setDeleteTarget(doc);
    setDeleteConfirmText("");
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmText.trim().toLowerCase() !== "delete") return;
    setDeleting(true);
    try {
      await deleteDocumentById(deleteTarget.id);
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      setDeleteOpen(false);
      setDeleteTarget(null);
      setDeleteConfirmText("");
      toast.success("Project deleted.");
    } catch {
      toast.error("Failed to delete project.");
    } finally {
      setDeleting(false);
    }
  };

  const skipGuide = () => {
    if (!user) return;
    completeProductTourForUser(user.id);
    setShowGuideNudge(false);
    toast.message("Guide skipped. You can reopen it from the Guide button.");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Co<span className="text-[#5170ff]">Research</span></h1>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" size="sm" data-tour-id="dashboard-guide" onClick={startProductTour}>
                <Sparkles className="w-4 h-4 mr-2" />Guide
              </Button>
              <Button variant="ghost" size="sm" data-tour-id="dashboard-discover" onClick={() => router.push("/discover")}>
                <Compass className="w-4 h-4 mr-2" />Discover
              </Button>
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => router.push("/admin")}>
                  <Settings className="w-4 h-4 mr-2" />Admin
                </Button>
              )}
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition-colors"
                onClick={() => router.push("/profile")}
                title="View profile"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-sm">
                    {user.name.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900 leading-none">{user.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{user.university.name}</p>
                </div>
              </button>
              <Button variant="ghost" size="sm" onClick={logout} title="Sign out">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>

            {/* Mobile nav */}
            <div className="flex items-center gap-2 md:hidden">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition-colors"
                onClick={() => router.push("/profile")}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-sm">
                    {user.name.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <XIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white px-4 py-3 space-y-1">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => { setMobileMenuOpen(false); router.push("/profile"); }}
            >
              <User className="w-4 h-4" />Profile
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              data-tour-id="dashboard-guide"
              onClick={() => { setMobileMenuOpen(false); startProductTour(); }}
            >
              <Sparkles className="w-4 h-4" />Guide
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              data-tour-id="dashboard-discover"
              onClick={() => { setMobileMenuOpen(false); router.push("/discover"); }}
            >
              <Compass className="w-4 h-4" />Discover
            </button>
            {isAdmin && (
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={() => { setMobileMenuOpen(false); router.push("/admin"); }}
              >
                <Settings className="w-4 h-4" />Admin
              </button>
            )}
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => { setMobileMenuOpen(false); logout(); }}
            >
              <LogOut className="w-4 h-4" />Sign out
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user.name.split(" ")[0]}!
          </h2>
          <p className="text-gray-600">
            Continue your research collaboration or start a new project.
          </p>
        </div>

        {guideStateReady && showGuideNudge && (
          <Card className="mb-8 overflow-hidden border-0 bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-900 text-white shadow-lg">
            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs uppercase tracking-wide">
                  <Rocket className="h-3.5 w-3.5" />
                  New here?
                </p>
                <h3 className="text-2xl font-semibold">Take the 2-minute interactive product guide</h3>
                <p className="max-w-2xl text-sm text-white/85">
                  Learn how to create papers, use the smart editor, publish to Discover, and collaborate with your university.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button className="bg-white text-slate-900 hover:bg-white/90" onClick={startProductTour}>
                  Start Guide
                </Button>
                <Button variant="ghost" className="text-white hover:bg-white/15 hover:text-white" onClick={skipGuide}>
                  Skip
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                My Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userDocuments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Collaborations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {userDocuments.filter((d) => d.ownerId !== user.id).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                In Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {userDocuments.filter((d) => d.stage === "review").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Published
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {userDocuments.filter((d) => d.stage === "published").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and New Project */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search your projects..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button data-tour-id="dashboard-new-paper" onClick={() => router.push("/document/new")}>
            <Plus className="w-4 h-4 mr-2" />
            New Research Paper
          </Button>
        </div>

        {/* Documents List */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Projects</TabsTrigger>
            <TabsTrigger value="owned">My Papers</TabsTrigger>
            <TabsTrigger value="collaborating">Collaborating</TabsTrigger>
          </TabsList>

          {/* Shared empty / loading state */}
          {loadingDocs && (
            <div className="py-12 text-center text-sm text-gray-400">Loading projects…</div>
          )}

          <TabsContent value="all" className="space-y-3 mt-4">
            {!loadingDocs && filteredDocuments.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
                  <p className="text-gray-500 mb-4 text-sm">Start your first research project or search for collaborators</p>
                  <Button onClick={() => router.push("/document/new")}>
                    <Plus className="w-4 h-4 mr-2" />Create New Paper
                  </Button>
                </CardContent>
              </Card>
            )}
            {filteredDocuments.map((doc) => <DocCard key={doc.id} doc={doc} />)}
          </TabsContent>

          <TabsContent value="owned" className="space-y-3 mt-4">
            {!loadingDocs && filteredDocuments.filter((d) => d.ownerId === user.id).length === 0 && (
              <div className="py-8 text-center text-sm text-gray-400">No papers you own yet.</div>
            )}
            {filteredDocuments.filter((d) => d.ownerId === user.id).map((doc) => <DocCard key={doc.id} doc={doc} />)}
          </TabsContent>

          <TabsContent value="collaborating" className="space-y-3 mt-4">
            {!loadingDocs && filteredDocuments.filter((d) => d.ownerId !== user.id).length === 0 && (
              <div className="py-8 text-center text-sm text-gray-400">No collaborations yet.</div>
            )}
            {filteredDocuments.filter((d) => d.ownerId !== user.id).map((doc) => <DocCard key={doc.id} doc={doc} />)}
          </TabsContent>
        </Tabs>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Project</DialogTitle>
              <DialogDescription>
                This action cannot be undone. Type <span className="font-semibold">delete</span> to confirm deleting{" "}
                <span className="font-semibold">{deleteTarget?.title ?? "this project"}</span>.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type delete"
              disabled={deleting}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteTarget(null);
                  setDeleteConfirmText("");
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleting || deleteConfirmText.trim().toLowerCase() !== "delete"}
              >
                {deleting ? "Deleting..." : "Delete Project"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}


