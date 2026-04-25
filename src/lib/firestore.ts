"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
} from "firebase/firestore";
import { db, firebaseEnvError } from "@/lib/firebase";
import type {
  ChatMessage,
  Comment,
  Document,
  DocumentPresence,
  PendingUser,
  University,
  User,
  UserRole,
} from "@/lib/types";

const USERS = "users";
const UNIVERSITIES = "universities";
const DOCUMENTS = "documents";
const PENDING_USERS = "pendingUsers";
const CHAT_MESSAGES = "chatMessages";
const DOCUMENT_COMMENTS = "documentComments";

function getDbOrThrow() {
  if (!db) {
    throw new Error(firebaseEnvError ?? "Firebase is not configured.");
  }
  return db;
}

export async function getUserProfile(uid: string): Promise<User | null> {
  const ref = doc(getDbOrThrow(), USERS, uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { ...(snap.data() as Omit<User, "id">), id: snap.id };
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const q = query(collection(getDbOrThrow(), USERS), where("email", "==", email));
  const snap = await getDocs(q);
  const first = snap.docs[0];
  if (!first) return null;
  return { ...(first.data() as Omit<User, "id">), id: first.id };
}

export async function saveUserProfile(uid: string, user: Omit<User, "id">) {
  const ref = doc(getDbOrThrow(), USERS, uid);
  await updateDoc(ref, { ...user });
}

export async function createUserProfile(uid: string, user: Omit<User, "id">) {
  const ref = doc(getDbOrThrow(), USERS, uid);
  await import("firebase/firestore").then(({ setDoc }) => setDoc(ref, user));
}

export async function getUniversities(): Promise<University[]> {
  const q = query(collection(getDbOrThrow(), UNIVERSITIES), orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<University, "id">), id: d.id }));
}

export async function getDocumentsForUser(userId: string): Promise<Document[]> {
  const dbRef = getDbOrThrow();
  const ownedQ = query(collection(dbRef, DOCUMENTS), where("ownerId", "==", userId));
  const collabQ = query(
    collection(dbRef, DOCUMENTS),
    where("collaboratorIds", "array-contains", userId),
  );

  const [ownedSnap, collabSnap] = await Promise.all([getDocs(ownedQ), getDocs(collabQ)]);
  const map = new Map<string, Document>();

  [...ownedSnap.docs, ...collabSnap.docs].forEach((d) => {
    map.set(d.id, { ...(d.data() as Omit<Document, "id">), id: d.id });
  });

  return Array.from(map.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDiscoverDocuments(): Promise<Document[]> {
  const dbRef = getDbOrThrow();
  const q = query(
    collection(dbRef, DOCUMENTS),
    where("stage", "==", "published"),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<Document, "id">), id: d.id }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDocumentById(id: string): Promise<Document | null> {
  const ref = doc(getDbOrThrow(), DOCUMENTS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { ...(snap.data() as Omit<Document, "id">), id: snap.id };
}

export function subscribeToDocumentById(
  id: string,
  onDocument: (document: Document | null) => void,
  onError?: (error: Error) => void,
) {
  const ref = doc(getDbOrThrow(), DOCUMENTS, id);
  return onSnapshot(
    ref,
    (snap) => {
      onDocument(snap.exists() ? { ...(snap.data() as Omit<Document, "id">), id: snap.id } : null);
    },
    (error) => onError?.(error),
  );
}

export async function createDocument(
  payload: Omit<Document, "id"> & { collaboratorIds: string[] },
): Promise<string> {
  const safePayload = { ...(payload as Omit<Document, "id"> & {
    collaboratorIds: string[];
    id?: string;
  }) };
  delete safePayload.id;
  const ref = await addDoc(collection(getDbOrThrow(), DOCUMENTS), safePayload);
  return ref.id;
}

export async function updateDocument(
  id: string,
  payload: Partial<Document> & { collaboratorIds?: string[] },
) {
  await updateDoc(doc(getDbOrThrow(), DOCUMENTS, id), payload);
}

export async function deleteDocumentById(id: string) {
  await deleteDoc(doc(getDbOrThrow(), DOCUMENTS, id));
}

export async function getPendingUsers(universityName: string): Promise<PendingUser[]> {
  const dbRef = getDbOrThrow();
  const q = query(
    collection(dbRef, PENDING_USERS),
    where("university", "==", universityName),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<PendingUser, "id">), id: d.id }))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function createPendingUser(
  pendingDocId: string,
  user: Omit<PendingUser, "id">,
) {
  await setDoc(doc(getDbOrThrow(), PENDING_USERS, pendingDocId), user);
}

export async function updatePendingUserStatus(
  id: string,
  status: PendingUser["status"],
  accountUserId?: string,
) {
  await updateDoc(doc(getDbOrThrow(), PENDING_USERS, id), { status });

  if (accountUserId) {
    await updateDoc(doc(getDbOrThrow(), USERS, accountUserId), {
      verified: status === "approved",
    });
  }
}

export async function getChatMessages(): Promise<ChatMessage[]> {
  const q = query(collection(getDbOrThrow(), CHAT_MESSAGES), orderBy("timestamp", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<ChatMessage, "id">), id: d.id }));
}

export async function getChatMessagesForUniversity(universityName: string): Promise<ChatMessage[]> {
  const q = query(collection(getDbOrThrow(), CHAT_MESSAGES), where("university", "==", universityName));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<ChatMessage, "id">), id: d.id }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function addChatMessage(msg: Omit<ChatMessage, "id">): Promise<ChatMessage> {
  const payload = Object.fromEntries(
    Object.entries(msg).filter(([, value]) => value !== undefined),
  ) as Omit<ChatMessage, "id">;
  const ref = await addDoc(collection(getDbOrThrow(), CHAT_MESSAGES), payload);
  return { ...payload, id: ref.id };
}

export async function getUsersByUniversity(universityName: string): Promise<User[]> {
  const q = query(collection(getDbOrThrow(), USERS), where("university.name", "==", universityName));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<User, "id">), id: d.id }));
}

export async function getCommentsForDocument(documentId: string): Promise<Comment[]> {
  const q = query(
    collection(getDbOrThrow(), DOCUMENT_COMMENTS),
    where("documentId", "==", documentId),
    orderBy("timestamp", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Comment, "id">), id: d.id }));
}

export async function addCommentToDocument(
  comment: Omit<Comment, "id">,
): Promise<Comment> {
  const ref = await addDoc(collection(getDbOrThrow(), DOCUMENT_COMMENTS), comment);
  return { ...comment, id: ref.id };
}

export function buildUserFromProfile(input: {
  email: string;
  name: string;
  university: University;
  studentId: string;
  program: string;
  year: number;
  interests: string[];
  role?: UserRole;
  verified?: boolean;
}): Omit<User, "id"> {
  return {
    email: input.email,
    name: input.name,
    role: input.role ?? "student",
    university: input.university,
    studentId: input.studentId,
    program: input.program,
    year: input.year,
    interests: input.interests,
    verified: input.verified ?? false,
  };
}

// Merge requests are stored directly on the branch Document — no separate collection needed.
// This means we only need the already-deployed /documents rules.

const DOCUMENT_PRESENCE = "documentPresence";

export async function upsertDocumentPresence(
  documentId: string,
  userId: string,
  data: Omit<DocumentPresence, "userId">,
) {
  const ref = doc(getDbOrThrow(), DOCUMENTS, documentId, DOCUMENT_PRESENCE, userId);
  await setDoc(ref, { userId, ...data }, { merge: true });
}

export async function removeDocumentPresence(documentId: string, userId: string) {
  const ref = doc(getDbOrThrow(), DOCUMENTS, documentId, DOCUMENT_PRESENCE, userId);
  await deleteDoc(ref);
}

export function subscribeToDocumentPresence(
  documentId: string,
  onPresence: (presence: DocumentPresence[]) => void,
) {
  const ref = collection(getDbOrThrow(), DOCUMENTS, documentId, DOCUMENT_PRESENCE);
  return onSnapshot(ref, (snap) => {
    onPresence(snap.docs.map((d) => d.data() as DocumentPresence));
  });
}

export async function getBranchDocumentsForParent(parentDocumentId: string): Promise<Document[]> {
  const q = query(collection(getDbOrThrow(), DOCUMENTS), where("parentDocumentId", "==", parentDocumentId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<Document, "id">), id: d.id }))
    .sort((a, b) => (b.mergeRequestCreatedAt ?? b.updatedAt).localeCompare(a.mergeRequestCreatedAt ?? a.updatedAt));
}
