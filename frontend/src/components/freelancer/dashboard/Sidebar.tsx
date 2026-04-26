"use client";

import { Box, Text, Badge, Stack, Group, Avatar, Divider, useMantineColorScheme } from "@mantine/core";
import { Home, Briefcase, Wallet, User, Sun, Moon, ChevronRight, Zap, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { Section } from "./types";

interface SidebarNavItemProps {
  icon: React.ReactNode;
  label: string;
  section: Section;
  active: boolean;
  badge?: number;
  onClick: () => void;
  isDark: boolean;
}

function SidebarNavItem({ icon, label, active, badge, onClick, isDark }: SidebarNavItemProps) {
  return (
    <Box
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 14px",
        borderRadius: 12,
        cursor: "pointer",
        transition: "all 0.2s ease",
        position: "relative",
        overflow: "hidden",
        backgroundColor: active
          ? isDark
            ? "rgba(6,182,212,0.12)"
            : "rgba(6,182,212,0.08)"
          : "transparent",
        color: active
          ? isDark
            ? "#e2e8f0"
            : "#0f172a"
          : isDark
          ? "#94a3b8"
          : "#64748b",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.backgroundColor = isDark
            ? "rgba(255,255,255,0.04)"
            : "rgba(2,8,23,0.04)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
        }
      }}
    >
      {active && (
        <Box
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 3,
            height: 20,
            background: "linear-gradient(180deg, #06b6d4, #4f46e5)",
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
          color: active ? "#06b6d4" : "inherit",
          transition: "color 0.2s",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Text fz="sm" fw={active ? 600 : 500} style={{ flex: 1, letterSpacing: "-0.01em" }}>
        {label}
      </Text>
      {badge !== undefined && (
        <Badge
          size="sm"
          variant={active ? "filled" : "light"}
          color="cyan"
          radius="sm"
          style={{
            minWidth: 22,
            height: 22,
            padding: "0 8px",
            fontSize: 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {badge}
        </Badge>
      )}
    </Box>
  );
}

interface SidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  pendingCount: number;
  onEditClick: () => void;
}

export function Sidebar({ activeSection, onSectionChange, pendingCount, onEditClick }: SidebarProps) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const { logout } = useAuth();

  return (
    <Box
      w={260}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        height: "100vh",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        backgroundColor: isDark ? "#2d3250" : "#ffffff",
        borderRight: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}`,
        boxShadow: isDark
          ? "0 0 40px rgba(0,0,0,0.3)"
          : "0 0 40px rgba(0,0,0,0.03)",
      }}
    >
      {/* Logo */}
      <Box p="lg" pb="sm">
        <Group gap="sm">
          <Box
            style={{
              width: 34,
              height: 34,
              background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(79,70,229,0.25)",
            }}
          >
            <Zap size={18} color="white" fill="white" />
          </Box>
          <Stack gap={0}>
            <Text fw={700} fz="lg" c={isDark ? "white" : "black"} lh={1.2}>
              NodeWorks
            </Text>
            <Text fz={10} c={isDark ? "#475569" : "#94a3b8"} fw={600} tt="uppercase" lh={1}>
              Freelancer
            </Text>
          </Stack>
        </Group>
      </Box>

      <Divider mx="lg" color={isDark ? "#1e293b" : "#f1f5f9"} />

      {/* Nav */}
      <Stack gap={4} px="md" pt="lg" flex={1}>
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

        <SidebarNavItem
          icon={<Home size={20} />}
          label="Home"
          section="home"
          active={activeSection === "home"}
          badge={pendingCount || undefined}
          onClick={() => onSectionChange("home")}
          isDark={isDark}
        />
        <SidebarNavItem
          icon={<Briefcase size={20} />}
          label="Browse Jobs"
          section="jobs"
          active={activeSection === "jobs"}
          badge={6}
          onClick={() => onSectionChange("jobs")}
          isDark={isDark}
        />
        <SidebarNavItem
          icon={<Wallet size={20} />}
          label="Earnings"
          section="earnings"
          active={activeSection === "earnings"}
          onClick={() => onSectionChange("earnings")}
          isDark={isDark}
        />
      </Stack>

      {/* Bottom: Profile + Theme */}
      <Stack gap="sm" p="md">
        <Divider color={isDark ? "#1e293b" : "#f1f5f9"} />

        {/* Profile Card */}
        <Box
          onClick={onEditClick}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 12,
            cursor: "pointer",
            transition: "all 0.2s ease",
            backgroundColor: "transparent",
            border: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = isDark
              ? "rgba(255,255,255,0.04)"
              : "rgba(2,8,23,0.03)";
            (e.currentTarget as HTMLElement).style.borderColor = isDark
              ? "#334155"
              : "#e2e8f0";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor = isDark
              ? "#1e293b"
              : "#f1f5f9";
          }}
        >
          <Box style={{ position: "relative" }}>
            <Avatar size={38} radius="xl" color="cyan" style={{ border: "2px solid rgba(6,182,212,0.2)" }}>
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
                border: `2px solid ${isDark ? "#0f172a" : "#ffffff"}`,
              }}
            />
          </Box>
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text fw={600} fz="sm" c={isDark ? "white" : "black"} lineClamp={1}>
              Ahmed Hassan
            </Text>
            <Text fz={11} c={isDark ? "#475569" : "#94a3b8"} lineClamp={1}>
              Senior Full-Stack Developer
            </Text>
          </Stack>
          <ChevronRight size={14} color={isDark ? "#475569" : "#cbd5e1"} />
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
            border: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = isDark
              ? "rgba(239,68,68,0.08)"
              : "rgba(239,68,68,0.06)";
            (e.currentTarget as HTMLElement).style.borderColor = isDark
              ? "#ef4444"
              : "#fca5a5";
            (e.currentTarget as HTMLElement).style.color = "#ef4444";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor = isDark
              ? "#1e293b"
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
            }}
          >
            <LogOut size={16} />
          </Box>
          <Text fz="sm" fw={500} style={{ flex: 1 }}>
            Sign out
          </Text>
        </Box>

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
            border: `1px solid ${isDark ? "#1e293b" : "#f1f5f9"}`,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = isDark
              ? "rgba(255,255,255,0.04)"
              : "rgba(2,8,23,0.03)";
            (e.currentTarget as HTMLElement).style.borderColor = isDark
              ? "#334155"
              : "#e2e8f0";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor = isDark
              ? "#1e293b"
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
              background: isDark ? "rgba(245,158,11,0.12)" : "rgba(99,102,241,0.12)",
              color: isDark ? "#f59e0b" : "#6366f1",
            }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </Box>
          <Text fz="sm" fw={500} style={{ flex: 1 }}>
            {isDark ? "Light mode" : "Dark mode"}
          </Text>
          <Box
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              background: isDark ? "#06b6d4" : "#e2e8f0",
              position: "relative",
              transition: "all 0.2s",
            }}
          >
            <Box
              style={{
                position: "absolute",
                top: 2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                transition: "all 0.2s",
                left: isDark ? 18 : 2,
              }}
            />
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}
