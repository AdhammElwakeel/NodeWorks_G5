"use client";

import { useState } from "react";
import {
  Box,
  Text,
  Stack,
  Group,
  Avatar,
  Divider,
  useMantineColorScheme,
} from "@mantine/core";
import {
  Home,
  Wallet,
  Briefcase,
  User,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import type { Section } from "./types";

interface SidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const displayName = user?.name || "User";
  const profileHeadline =
    (user as any)?.freelancerProfile?.headline || "Freelancer";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isBrowseActive = pathname === "/freelancer/jobs";

  const isProfileActive = activeSection === "profile" && !isBrowseActive;

  const navItems = [
    {
      icon: <Home size={20} />,
      label: "Home",
      section: "home" as Section,
      active: activeSection === "home" && !isBrowseActive,
    },
    {
      icon: <Briefcase size={20} />,
      label: "Browse Jobs",
      section: "browse" as Section,
      active: isBrowseActive,
    },
    {
      icon: <Wallet size={20} />,
      label: "Earnings",
      section: "earnings" as Section,
      active: activeSection === "earnings" && !isBrowseActive,
    },
  ];

  const handleNavClick = (section: Section) => {
    if (section === "browse") {
      router.push("/freelancer/jobs");
    } else if (pathname === "/freelancer/dashboard") {
      onSectionChange(section);
    } else {
      const sectionParam =
        section === "home" ? "" : `?section=${section}`;
      router.push(`/freelancer/dashboard${sectionParam}`);
    }
  };

  const handleProfileClick = () => {
    if (pathname === "/freelancer/dashboard") {
      onSectionChange("profile");
    } else {
      router.push("/freelancer/dashboard?section=profile");
    }
  };

  const COLLAPSED_WIDTH = 80;
  const EXPANDED_WIDTH = 260;
  const sidebarWidth = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  return (
    <Box
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        height: "100vh",
        backgroundColor: isDark ? "#1e293b" : "#ffffff",
        borderRight: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        boxShadow: isExpanded
          ? "4px 0 24px rgba(0,0,0,0.1)"
          : "2px 0 8px rgba(0,0,0,0.04)",
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Logo */}
      <Box
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isExpanded ? "flex-start" : "center",
          gap: 12,
          padding: isExpanded ? "16px 20px" : "16px 0",
          minHeight: 72,
        }}
      >
        <Box style={{ flexShrink: 0 }}>
          <Image
            src="/logo.svg"
            alt="NodeWorks"
            width={40}
            height={40}
            priority
          />
        </Box>
        {isExpanded && (
          <Stack gap={0} style={{ overflow: "hidden" }}>
            <Text
              fw={700}
              fz="lg"
              c={isDark ? "white" : "black"}
              lh={1.2}
            >
              NodeWorks
            </Text>
            <Text
              fz={10}
              c={isDark ? "#475569" : "#94a3b8"}
              fw={600}
              tt="uppercase"
              lh={1}
            >
              Freelancer
            </Text>
          </Stack>
        )}
      </Box>

      <Divider mx="lg" color={isDark ? "#334155" : "#f1f5f9"} />

      {/* Profile Card / Avatar */}
      <Box
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isExpanded ? "flex-start" : "center",
          padding: isExpanded ? "12px 16px" : "12px 0",
        }}
      >
        {isExpanded ? (
          <Box
            onClick={handleProfileClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 12,
              cursor: "pointer",
              transition: "all 0.2s ease",
              backgroundColor: isProfileActive
                ? isDark
                  ? "rgba(6,182,212,0.12)"
                  : "rgba(6,182,212,0.08)"
                : "transparent",
              border: `1px solid ${
                isProfileActive
                  ? "rgba(6,182,212,0.3)"
                  : isDark
                    ? "#334155"
                    : "#f1f5f9"
              }`,
              width: "100%",
            }}
            onMouseEnter={(e) => {
              if (!isProfileActive) {
                (e.currentTarget as HTMLElement).style.backgroundColor = isDark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(2,8,23,0.03)";
                (e.currentTarget as HTMLElement).style.borderColor = isDark
                  ? "#475569"
                  : "#e2e8f0";
              }
            }}
            onMouseLeave={(e) => {
              if (!isProfileActive) {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent";
                (e.currentTarget as HTMLElement).style.borderColor = isDark
                  ? "#334155"
                  : "#f1f5f9";
              }
            }}
          >
            <Box style={{ position: "relative", flexShrink: 0 }}>
              <Avatar
                size={38}
                radius="xl"
                color="cyan"
                style={{
                  border: "2px solid rgba(6,182,212,0.2)",
                }}
              >
                <User size={18} />
              </Avatar>
              <Box
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#22c55e",
                  border: `2px solid ${isDark ? "#1e293b" : "#ffffff"}`,
                }}
              />
            </Box>
            <Stack
              gap={2}
              style={{ flex: 1, minWidth: 0, overflow: "hidden" }}
            >
              <Text
                fw={600}
                fz="sm"
                c={isDark ? "white" : "black"}
                lineClamp={1}
              >
                {displayName}
              </Text>
              <Text
                fz={11}
                c={isDark ? "#475569" : "#94a3b8"}
                lineClamp={1}
              >
                {profileHeadline}
              </Text>
            </Stack>
          </Box>
        ) : (
          <Box
            onClick={handleProfileClick}
            style={{
              cursor: "pointer",
              position: "relative",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: isProfileActive
                ? "rgba(6,182,212,0.08)"
                : "transparent",
            }}
          >
            {isProfileActive && (
              <Box
                style={{
                  position: "absolute",
                  left: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 3,
                  height: 20,
                  background:
                    "linear-gradient(180deg, #06b6d4, #4f46e5)",
                  borderRadius: "0 4px 4px 0",
                }}
              />
            )}
            <Avatar
              size={34}
              radius="xl"
              color="cyan"
              style={{
                border: isProfileActive
                  ? "2px solid rgba(6,182,212,0.4)"
                  : "2px solid rgba(6,182,212,0.2)",
              }}
            >
              {initials}
            </Avatar>
            <Box
              style={{
                position: "absolute",
                bottom: 2,
                right: 2,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                border: `2px solid ${isDark ? "#1e293b" : "#ffffff"}`,
              }}
            />
          </Box>
        )}
      </Box>

      <Divider mx="lg" color={isDark ? "#334155" : "#f1f5f9"} />

      {/* Navigation */}
      <Stack gap={4} px="md" pt="sm" flex={1}>
        {isExpanded && (
          <Text
            fz={11}
            fw={700}
            tt="uppercase"
            c={isDark ? "#475569" : "#94a3b8"}
            mb={4}
            ml={14}
            style={{ letterSpacing: "0.08em" }}
          >
            Menu
          </Text>
        )}
        {navItems.map((item) => (
          <Box
            key={item.section}
            onClick={() => handleNavClick(item.section)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: isExpanded ? "flex-start" : "center",
              gap: isExpanded ? 14 : 0,
              padding: isExpanded ? "12px 14px" : "10px 0",
              borderRadius: 12,
              cursor: "pointer",
              transition: "all 0.2s ease",
              position: "relative",
              overflow: "hidden",
              backgroundColor: item.active
                ? isDark
                  ? "rgba(6,182,212,0.12)"
                  : "rgba(6,182,212,0.08)"
                : "transparent",
              color: item.active
                ? isDark
                  ? "#e2e8f0"
                  : "#0f172a"
                : isDark
                  ? "#94a3b8"
                  : "#64748b",
            }}
            onMouseEnter={(e) => {
              if (!item.active) {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  isDark
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(2,8,23,0.04)";
              }
            }}
            onMouseLeave={(e) => {
              if (!item.active) {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent";
              }
            }}
          >
            {item.active && (
              <Box
                style={{
                  position: "absolute",
                  left: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 3,
                  height: 20,
                  background:
                    "linear-gradient(180deg, #06b6d4, #4f46e5)",
                  borderRadius: "0 4px 4px 0",
                }}
              />
            )}
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                flexShrink: 0,
                color: item.active ? "#06b6d4" : "inherit",
                transition: "color 0.2s",
              }}
            >
              {item.icon}
            </Box>
            {isExpanded && (
              <Text
                fz="sm"
                fw={item.active ? 600 : 500}
                style={{
                  flex: 1,
                  letterSpacing: "-0.01em",
                }}
              >
                {item.label}
              </Text>
            )}
          </Box>
        ))}
      </Stack>

      {/* Bottom Section */}
      <Box p="md">
        <Divider color={isDark ? "#334155" : "#f1f5f9"} mb="sm" />

        {isExpanded ? (
          <Stack gap="xs">
            {/* Theme Toggle */}
            <Box
              onClick={() => setColorScheme(isDark ? "light" : "dark")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 12,
                cursor: "pointer",
                transition: "all 0.2s ease",
                backgroundColor: "transparent",
                color: isDark ? "#94a3b8" : "#64748b",
                border: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = isDark
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(2,8,23,0.03)";
                (e.currentTarget as HTMLElement).style.borderColor = isDark
                  ? "#475569"
                  : "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent";
                (e.currentTarget as HTMLElement).style.borderColor = isDark
                  ? "#334155"
                  : "#f1f5f9";
              }}
            >
              <Box
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: isDark
                    ? "rgba(245,158,11,0.12)"
                    : "rgba(99,102,241,0.12)",
                  color: isDark ? "#f59e0b" : "#6366f1",
                  flexShrink: 0,
                }}
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </Box>
              <Text fw={500} fz="sm" style={{ flex: 1 }}>
                {isDark ? "Light mode" : "Dark mode"}
              </Text>
            </Box>

            {/* Sign Out */}
            <Box
              onClick={logout}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 12,
                cursor: "pointer",
                transition: "all 0.2s ease",
                backgroundColor: "transparent",
                color: isDark ? "#94a3b8" : "#64748b",
                border: `1px solid ${isDark ? "#334155" : "#f1f5f9"}`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "rgba(239,68,68,0.06)";
                (e.currentTarget as HTMLElement).style.borderColor = "#fca5a5";
                (e.currentTarget as HTMLElement).style.color = "#ef4444";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent";
                (e.currentTarget as HTMLElement).style.borderColor = isDark
                  ? "#334155"
                  : "#f1f5f9";
                (e.currentTarget as HTMLElement).style.color = isDark
                  ? "#94a3b8"
                  : "#64748b";
              }}
            >
              <Box
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "rgba(239,68,68,0.1)",
                  color: "#ef4444",
                  flexShrink: 0,
                }}
              >
                <LogOut size={16} />
              </Box>
              <Text fw={500} fz="sm" style={{ flex: 1 }}>
                Sign out
              </Text>
            </Box>
          </Stack>
        ) : (
          <Stack gap={4} align="center">
            <Box
              title={isDark ? "Light Mode" : "Dark Mode"}
              onClick={() => setColorScheme(isDark ? "light" : "dark")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: 12,
                cursor: "pointer",
                color: isDark ? "#94a3b8" : "#64748b",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(2,8,23,0.04)";
                (e.currentTarget as HTMLElement).style.color = isDark
                  ? "#e2e8f0"
                  : "#0f172a";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent";
                (e.currentTarget as HTMLElement).style.color = isDark
                  ? "#94a3b8"
                  : "#64748b";
              }}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </Box>

            <Box
              title="Sign Out"
              onClick={logout}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: 12,
                cursor: "pointer",
                color: isDark ? "#94a3b8" : "#64748b",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "rgba(239,68,68,0.06)";
                (e.currentTarget as HTMLElement).style.color = "#ef4444";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent";
                (e.currentTarget as HTMLElement).style.color = isDark
                  ? "#94a3b8"
                  : "#64748b";
              }}
            >
              <LogOut size={20} />
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  );
}