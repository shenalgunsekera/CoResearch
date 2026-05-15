"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Document } from "@/lib/types";
import { deleteDocumentById, getDocumentsForUser } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
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
    async function loadDocuments() {
      if (!user) return;
      setLoadingDocs(true);
      try {
        const data = await getDocumentsForUser(user.id);
        setDocuments(data);
      } finally {
        setLoadingDocs(false);
      }
    }

    loadDocuments();
  }, [user]);

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
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "review":
        return "bg-blue-100 text-blue-800";
      case "published":
        return "bg-green-100 text-green-800";
    }
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

          <TabsContent value="all" className="space-y-4 mt-6">
            {loadingDocs ? (
              <Card>
                <CardContent className="py-12 text-center text-sm text-gray-600">
                  Loading projects...
                </CardContent>
              </Card>
            ) : filteredDocuments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No projects found
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Start your first research project or search for collaborators
                  </p>
                  <Button onClick={() => router.push("/document/new")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Paper
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredDocuments.map((doc) => (
                <Card
                  key={doc.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/document/${doc.id}`)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="mb-2">{doc.title}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>by {doc.ownerName}</span>
                          <span>&bull;</span>
                          <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Badge className={getStageColor(doc.stage)}>
                        {doc.stage.charAt(0).toUpperCase() + doc.stage.slice(1)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Badge variant="outline">{doc.field}</Badge>
                      <Badge variant="outline">{doc.topic}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{doc.collaborators.length} collaborators</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          <span>v{doc.currentVersion}</span>
                        </div>
                      </div>
                      {doc.ownerId === user.id && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(event) => openDeleteDialog(doc, event)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="owned" className="space-y-4 mt-6">
            {filteredDocuments
              .filter((doc) => doc.ownerId === user.id)
              .map((doc) => (
                <Card
                  key={doc.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/document/${doc.id}`)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="mb-2">{doc.title}</CardTitle>
                        <CardDescription>
                          Last updated {new Date(doc.updatedAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge className={getStageColor(doc.stage)}>
                        {doc.stage.charAt(0).toUpperCase() + doc.stage.slice(1)}
                      </Badge>
                    </div>
                    {doc.ownerId === user.id && (
                      <div className="mt-4">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(event) => openDeleteDialog(doc, event)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                </Card>
              ))}
          </TabsContent>

          <TabsContent value="collaborating" className="space-y-4 mt-6">
            {filteredDocuments
              .filter((doc) => doc.ownerId !== user.id)
              .map((doc) => (
                <Card
                  key={doc.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/document/${doc.id}`)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="mb-2">{doc.title}</CardTitle>
                        <CardDescription>by {doc.ownerName}</CardDescription>
                      </div>
                      <Badge className={getStageColor(doc.stage)}>
                        {doc.stage.charAt(0).toUpperCase() + doc.stage.slice(1)}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              ))}
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


