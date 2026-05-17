export type UserRole = "student" | "admin";

export interface University {
  id: string;
  name: string;
  domain: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  university: University;
  studentId: string;
  program: string;
  year: number;
  interests: string[];
  verified: boolean;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  imageUrls?: string[];
  coverImageUrl?: string;
  abstract?: string;
  keywords?: string[];
  publishVisibility?: "public" | "private";
  publishedAt?: string;
  readTimeMinutes?: number;
  ownerId: string;
  ownerName: string;
  collaborators: Collaborator[];
  versions: Version[];
  currentVersion: number;
  field: string;
  topic: string;
  stage: "draft" | "review" | "published";
  createdAt: string;
  updatedAt: string;
  university: string;
  // Branch tracking
  parentDocumentId?: string;
  branchLabel?: string;
  branchAncestorContent?: string;
  // Merge request — stored on the branch document itself (no separate collection needed)
  mergeRequestStatus?: "pending" | "merged" | "rejected";
  mergeRequestMessage?: string;
  mergeRequestCreatedAt?: string;
  mergeRequestAuthorId?: string;
  mergeRequestAuthorName?: string;
  mergeRequestResolvedAt?: string;
  mergeRequestResolvedBy?: string;
}

export interface MergeRequest {
  id: string;
  branchDocumentId: string;
  branchTitle: string;
  parentDocumentId: string;
  authorId: string;
  authorName: string;
  message: string;
  status: "pending" | "merged" | "rejected";
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  role: "owner" | "editor" | "viewer";
  joinedAt: string;
}

export interface Version {
  id: string;
  version: number;
  content: string;
  author: string;
  authorId: string;
  timestamp: string;
  message: string;
  changes: Change[];
}

export interface Change {
  type: "addition" | "deletion" | "modification";
  line: number;
  content: string;
}

export interface Comment {
  id: string;
  documentId: string;
  author: string;
  authorId: string;
  content: string;
  selection: {
    start: number;
    end: number;
  };
  timestamp: string;
  resolved: boolean;
  replies: Reply[];
}

export interface Reply {
  id: string;
  author: string;
  authorId: string;
  content: string;
  timestamp: string;
}

export interface AIInsight {
  type: "summary" | "suggestion" | "inconsistency" | "contribution";
  content: string;
  confidence: number;
  section?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  imageUrl?: string;
  university: string;
  timestamp: string;
  channel: string;
}

export interface DocumentPresence {
  userId: string;
  userName: string;
  color: string;
  cursorFrom: number | null;
  lastSeen: string;
  mouseX?: number | null; // percentage 0–100 relative to editor container
  mouseY?: number | null;
}

export interface PendingUser {
  id: string;
  userId?: string;
  email: string;
  name: string;
  studentId: string;
  program: string;
  year: number;
  interests: string[];
  university: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  universityId: string;
  studentId: string;
  program: string;
  year: number;
  interests: string[];
}
