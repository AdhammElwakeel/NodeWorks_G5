"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Loader, Center } from "@mantine/core";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "freelancer" | "client";
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // Not authenticated — redirect to login with return URL
      const returnUrl = encodeURIComponent(pathname);
      router.push(`/login?redirect=${returnUrl}`);
      return;
    }

    // Authenticated but wrong role
    if (requiredRole && user.role !== requiredRole) {
      if (user.role === "client") {
        router.push("/client/dashboard");
      } else {
        router.push("/freelancer/dashboard");
      }
      return;
    }
  }, [user, loading, router, pathname, requiredRole]);

  if (loading) {
    return (
      <Center style={{ minHeight: "100vh" }}>
        <Loader size="lg" color="indigo" />
      </Center>
    );
  }

  if (!user) {
    return (
      <Center style={{ minHeight: "100vh" }}>
        <Loader size="lg" color="indigo" />
      </Center>
    );
  }

  if (requiredRole && user.role !== requiredRole) {
    return (
      <Center style={{ minHeight: "100vh" }}>
        <Loader size="lg" color="indigo" />
      </Center>
    );
  }

  return <>{children}</>;
}
