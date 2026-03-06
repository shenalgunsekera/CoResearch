"use client";

import { useState } from "react";
import { useEffect } from "react";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { Document, ChatMessage, User } from "@/lib/types";
import {
  addChatMessage,
  getDiscoverDocuments,
} from "@/lib/firestore";
import { uploadChatImage } from "@/lib/storage";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Search, BookOpen, MessageSquare, Send, Users, Compass, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";

export default function DiscoverPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [fieldFilter, setFieldFilter] = useState("all");
  const [chatMessage, setChatMessage] = useState("");
  const [chatImageUrl, setChatImageUrl] = useState("");
  const [chatImageUploading, setChatImageUploading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const chatImageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    async function loadDocuments() {
      setLoadingData(true);
      try {
        const docs = await getDiscoverDocuments();
        setDocuments(docs);
      } finally {
        setLoadingData(false);
      }
    }
    loadDocuments();
  }, [user]);

  useEffect(() => {
    if (!user || !db) return;
    const messagesQuery = query(
      collection(db, "chatMessages"),
      where("university", "==", user.university.name),
    );
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const data = snapshot.docs
        .map((d) => ({ ...(d.data() as Omit<ChatMessage, "id">), id: d.id }))
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      setMessages(data);
    });

    const usersQuery = query(collection(db, "users"), where("university.name", "==", user.university.name));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const users = snapshot.docs.map((d) => ({ ...(d.data() as Omit<User, "id">), id: d.id }));
      setOnlineUsers(users.filter((u) => u.verified));
    });

    return () => {
      unsubscribeMessages();
      unsubscribeUsers();
    };
  }, [user]);

  if (isLoading || !user) return null;

  const publicDocuments = documents.filter(
    (doc) => doc.stage === "published" && (doc.publishVisibility ?? "public") === "public"
  );

  const filteredDocuments = publicDocuments.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.topic.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesField = fieldFilter === "all" || doc.field === fieldFilter;
    return matchesSearch && matchesField;
  });

  const fields = Array.from(new Set(documents.map((d) => d.field)));

  const handleUploadChatImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return toast.error("Please upload an image.");
    if (file.size > 8 * 1024 * 1024) return toast.error("Image must be under 8MB.");
    setChatImageUploading(true);
    try {
      const imageUrl = await uploadChatImage(user.id, file);
      setChatImageUrl(imageUrl);
      toast.success("Image attached.");
    } catch {
      toast.error("Failed to upload image.");
    } finally {
      setChatImageUploading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chatSending) return;
    if (!chatMessage.trim() && !chatImageUrl) return;

    const newMessagePayload: Omit<ChatMessage, "id"> = {
      senderId: user.id,
      senderName: user.name,
      content: chatMessage.trim(),
      university: user.university.name,
      timestamp: new Date().toISOString(),
      channel: "general",
    };
    if (chatImageUrl) {
      newMessagePayload.imageUrl = chatImageUrl;
    }

    setChatSending(true);
    try {
      await addChatMessage(newMessagePayload);
      // Realtime listener updates messages state; avoid local append duplicates.
      setChatMessage("");
      setChatImageUrl("");
      toast.success("Message sent!");
    } finally {
      setChatSending(false);
    }
  };

  const handleRequestJoin = () => {
    toast.success("Join request sent to document owner!");
  };

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
                data-tour-id="discover-back"
                onClick={() => router.push("/dashboard")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Compass className="w-6 h-6 text-blue-600" />
                <h1 className="text-xl font-bold">Discover & Collaborate</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarFallback>
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="projects" className="w-full">
          <TabsList>
            <TabsTrigger value="projects" data-tour-id="discover-projects-tab">
              <BookOpen className="w-4 h-4 mr-2" />
              Browse Projects
            </TabsTrigger>
            <TabsTrigger value="chat" data-tour-id="discover-chat-tab">
              <MessageSquare className="w-4 h-4 mr-2" />
              Knowledge Sharing
            </TabsTrigger>
          </TabsList>

          {/* Browse Projects Tab */}
          <TabsContent value="projects" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Find Research Projects</CardTitle>
                <CardDescription>
                  Discover ongoing research and request to collaborate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      data-tour-id="discover-search-input"
                      placeholder="Search projects by title or topic..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={fieldFilter} onValueChange={setFieldFilter}>
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue placeholder="All Fields" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Fields</SelectItem>
                      {fields.map((field) => (
                        <SelectItem key={field} value={field}>
                          {field}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  {loadingData ? (
                    <div className="text-center py-12 text-sm text-gray-600">
                      Loading projects...
                    </div>
                  ) : filteredDocuments.length === 0 ? (
                    <div className="text-center py-12">
                      <Compass className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No projects found
                      </h3>
                      <p className="text-gray-600">Try adjusting your search filters</p>
                    </div>
                  ) : (
                    filteredDocuments.map((doc) => (
                      <Card key={doc.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-6">
                          {doc.coverImageUrl && (
                            <div className="relative mb-4 h-44 w-full overflow-hidden rounded-lg">
                              <NextImage
                                src={doc.coverImageUrl}
                                alt={`${doc.title} cover`}
                                fill
                                unoptimized
                                className="object-cover"
                                sizes="(max-width: 1024px) 100vw, 720px"
                              />
                            </div>
                          )}
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold mb-2">{doc.title}</h3>
                              <p className="text-sm text-gray-600 mb-3">
                                by {doc.ownerName} &bull; {doc.university}
                              </p>
                              {doc.abstract && (
                                <p className="mb-3 text-sm text-gray-700 line-clamp-3">{doc.abstract}</p>
                              )}
                              <div className="flex flex-wrap gap-2 mb-3">
                                <Badge>{doc.field}</Badge>
                                <Badge variant="outline">{doc.topic}</Badge>
                                <Badge
                                  className={
                                    doc.stage === "published"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-blue-100 text-blue-800"
                                  }
                                >
                                  {doc.stage.charAt(0).toUpperCase() + doc.stage.slice(1)}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600">
                                <div className="flex items-center gap-1">
                                  <Users className="w-4 h-4" />
                                  <span>{doc.collaborators.length} collaborators</span>
                                </div>
                                {typeof doc.readTimeMinutes === "number" && (
                                  <span>{doc.readTimeMinutes} min read</span>
                                )}
                                <span>
                                  Published {new Date(doc.publishedAt ?? doc.updatedAt).toLocaleDateString()}
                                </span>
                              </div>
                              {Array.isArray(doc.keywords) && doc.keywords.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {doc.keywords.slice(0, 6).map((keyword) => (
                                    <Badge key={keyword} variant="secondary">{keyword}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 ml-4">
                              <Button
                                size="sm"
                                onClick={() => router.push(`/document/${doc.id}`)}
                              >
                                View Paper
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                data-tour-id="discover-request-join"
                                onClick={handleRequestJoin}
                              >
                                Request to Join
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Knowledge Sharing Chat Tab */}
          <TabsContent value="chat" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Chat Area */}
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>General Discussion</CardTitle>
                  <CardDescription>
                    Share knowledge and connect with fellow researchers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${
                          msg.senderId === user.id ? "flex-row-reverse" : ""
                        }`}
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>
                            {msg.senderName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`flex-1 ${
                            msg.senderId === user.id ? "text-right" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{msg.senderName}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div
                            className={`inline-block p-3 rounded-lg ${
                              msg.senderId === user.id
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-900"
                            }`}
                          >
                            {msg.content && <p className="text-sm">{msg.content}</p>}
                            {msg.imageUrl && (
                              <a href={msg.imageUrl} target="_blank" rel="noreferrer" className="mt-2 block">
                                <div className="relative h-48 w-72 max-w-full overflow-hidden rounded-md border border-black/10">
                                  <NextImage src={msg.imageUrl} alt="chat-image" fill unoptimized className="object-cover" sizes="(max-width: 768px) 80vw, 360px" />
                                </div>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input
                      ref={chatImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadChatImage}
                    />
                    <Input
                      data-tour-id="discover-chat-input"
                      placeholder="Type your message..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      disabled={chatSending}
                    />
                    <Button type="button" variant="outline" onClick={() => chatImageInputRef.current?.click()} disabled={chatImageUploading || chatSending}>
                      <ImagePlus className="w-4 h-4" />
                    </Button>
                    <Button type="submit" disabled={chatSending || chatImageUploading}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                  {chatImageUrl && (
                    <div className="mt-3 flex items-center gap-2 rounded-md border p-2">
                      <div className="relative h-14 w-20 overflow-hidden rounded">
                        <NextImage src={chatImageUrl} alt="pending-chat-image" fill unoptimized className="object-cover" sizes="80px" />
                      </div>
                      <p className="text-xs text-gray-600">Image ready to send</p>
                      <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => setChatImageUrl("")}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Online Users */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Online Now
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {onlineUsers.length === 0 ? (
                    <p className="text-sm text-gray-500">No verified users online in your university.</p>
                  ) : onlineUsers.slice(0, 12).map((member) => (
                    <div key={member.id} className="flex items-center gap-2">
                      <div className="relative">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>{member.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.program}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}



