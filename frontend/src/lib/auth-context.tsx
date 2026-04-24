"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { authApi, profileApi } from "./api";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatar: string | null;
  freelancerProfile?: any;
  clientProfile?: any;
  cv?: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    role: "freelancer" | "client";
  }) => Promise<void>;
  logout: () => void;
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
    refreshUser().finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const data = await authApi.login({ email, password });
    setUser(data.user);
  }

  async function register(data: {
    email: string;
    password: string;
    name: string;
    role: "freelancer" | "client";
  }) {
    const res = await authApi.register(data);
    setUser(res.user);
  }

  function logout() {
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
