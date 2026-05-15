"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword as firebaseUpdatePassword,
} from "firebase/auth";
import type { RegisterData, User } from "@/lib/types";
import { auth, firebaseEnvError } from "@/lib/firebase";
import {
  buildUserFromProfile,
  createPendingUser,
  createUserProfile,
  getUniversities,
  getUserProfile,
  updateUserProfile,
} from "@/lib/firestore";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, portal?: "student" | "university") => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (fields: { name?: string; program?: string; year?: number; interests?: string[] }) => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          return;
        }

        const profile = await getUserProfile(firebaseUser.uid);
        setUser(profile);
      } catch (error) {
        console.error("Auth state load failed", error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const login = async (
    email: string,
    password: string,
    portal: "student" | "university" = "student",
  ) => {
    if (!auth) {
      throw new Error(firebaseEnvError ?? "Firebase is not configured.");
    }

    setIsLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const profile = await getUserProfile(cred.user.uid);

      if (!profile) {
        throw new Error("Account profile not found.");
      }

      if (portal === "university" && profile.role !== "admin") {
        await signOut(auth);
        throw new Error("Student accounts cannot log in from University Admin access.");
      }

      setUser(profile);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    if (!auth) {
      throw new Error(firebaseEnvError ?? "Firebase is not configured.");
    }

    setIsLoading(true);
    try {
      const universities = await getUniversities();
      const university = universities.find((u) => u.id === data.universityId);

      if (!university) {
        throw new Error("University not found.");
      }

      const cred = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password,
      );

      const profileNoId = buildUserFromProfile({
        email: data.email,
        name: data.name,
        university,
        studentId: data.studentId,
        program: data.program,
        year: data.year,
        interests: data.interests,
        role: "student",
        verified: false,
      });

      await createUserProfile(cred.user.uid, profileNoId);

      await createPendingUser(cred.user.uid, {
        userId: cred.user.uid,
        email: data.email,
        name: data.name,
        studentId: data.studentId,
        program: data.program,
        year: data.year,
        interests: data.interests,
        university: university.name,
        submittedAt: new Date().toISOString(),
        status: "pending",
      });

      await signOut(auth);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (!auth) {
      throw new Error(firebaseEnvError ?? "Firebase is not configured.");
    }

    await signOut(auth);
    setUser(null);
  };

  const refreshUser = async (): Promise<User | null> => {
    if (!auth) {
      throw new Error(firebaseEnvError ?? "Firebase is not configured.");
    }
    if (!auth.currentUser) {
      setUser(null);
      return null;
    }
    const profile = await getUserProfile(auth.currentUser.uid);
    setUser(profile);
    return profile;
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!auth?.currentUser) throw new Error("Not authenticated.");
    const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await firebaseUpdatePassword(auth.currentUser, newPassword);
  };

  const updateProfile = async (fields: { name?: string; program?: string; year?: number; interests?: string[] }) => {
    if (!auth?.currentUser) throw new Error("Not authenticated.");
    await updateUserProfile(auth.currentUser.uid, fields);
    setUser((prev) => (prev ? { ...prev, ...fields } : prev));
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    refreshUser,
    changePassword,
    updateProfile,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
