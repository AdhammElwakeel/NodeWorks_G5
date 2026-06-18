"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { authApi, profileApi } from "./api";

interface FreelancerProfileData {
  headline?: string;
  experienceLevel?: string;
  country?: string;
  skills?: string[];
  about?: string;
  hourlyRate?: number;
  availability?: string;
  portfolioLinks?: string[];
  cvFileName?: string;
  cvAnalysis?: Record<string, unknown> | null;
  aiInterviewReport?: Record<string, unknown> | null;
  createdAt?: string;
}

interface ClientProfileData {
  companyName?: string;
  industry?: string;
  companySize?: string;
  description?: string;
  website?: string;
  location?: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatar: string | null;
  freelancerProfile?: FreelancerProfileData | null;
  clientProfile?: ClientProfileData | null;
  cv?: unknown;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    role: "freelancer" | "client";
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const data = await profileApi.get();
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      profileApi
        .get()
        .then((data) => {
          if (!cancelled) setUser(data.user);
        })
        .catch(() => {
          if (!cancelled) setUser(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string): Promise<User> {
    const data = await authApi.login({ email, password });
    try {
      const profileData = await profileApi.get();
      setUser(profileData.user);
      return profileData.user;
    } catch {
      setUser(data.user);
      return data.user;
    }
  }

  async function register(data: {
    email: string;
    password: string;
    name: string;
    role: "freelancer" | "client";
  }) {
    const res = await authApi.register(data);
    try {
      const profileData = await profileApi.get();
      setUser(profileData.user);
    } catch {
      setUser(res.user);
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      // Continue locally even if the network request fails.
    }
    setUser(null);
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
