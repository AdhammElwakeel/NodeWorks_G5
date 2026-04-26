"use client";

import { Box, Text, Badge, Stack, Group, Avatar, Divider } from "@mantine/core";
import { Home, Briefcase, Wallet, User, ChevronRight, Zap, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { Section } from "./types";

interface SidebarNavItemProps {
  icon: React.ReactNode;
  label: string;
  section: Section;
  active: boolean;
  badge?: number;
  onClick: () => void;
}

function SidebarNavItem({ icon, label, active, badge, onClick }: SidebarNavItemProps) {
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
        backgroundColor: active ? "rgba(6,182,212,0.08)" : "transparent",
        color: active ? "#0f172a" : "#64748b",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(2,8,23,0.04)";
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
  const { user, logout } = useAuth();
  const displayName = user?.name || "Freelancer";
  const displayRole = user?.freelancerProfile?.headline || "Freelancer Account";

  return (
    <Box
      w={260}
      style={{
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        borderRight: "1px solid #f1f5f9",
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
            <Text fw={700} fz="lg" c="black" lh={1.2}>
              NodeWorks
            </Text>
            <Text fz={10} c="#94a3b8" fw={600} tt="uppercase" lh={1}>
              Freelancer
            </Text>
          </Stack>
        </Group>
      </Box>

      <Divider mx="lg" color="#f1f5f9" />

      {/* Nav */}
      <Stack gap={4} px="md" pt="lg" flex={1}>
        <Text
          fz={11}
          fw={700}
          tt="uppercase"
          c="#94a3b8"
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
        />
        <SidebarNavItem
          icon={<Briefcase size={20} />}
          label="Browse Jobs"
          section="jobs"
          active={activeSection === "jobs"}
          badge={6}
          onClick={() => onSectionChange("jobs")}
        />
        <SidebarNavItem
          icon={<Wallet size={20} />}
          label="Earnings"
          section="earnings"
          active={activeSection === "earnings"}
          onClick={() => onSectionChange("earnings")}
        />
      </Stack>

      {/* Bottom: Profile + Sign Out */}
      <Stack gap="sm" p="md">
        <Divider color="#f1f5f9" />

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
            border: "1px solid #f1f5f9",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(2,8,23,0.03)";
            (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor = "#f1f5f9";
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
                border: "2px solid #ffffff",
              }}
            />
          </Box>
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text fw={600} fz="sm" c="black" lineClamp={1}>
              {displayName}
            </Text>
            <Text fz={11} c="#94a3b8" lineClamp={1}>
              {displayRole}
            </Text>
          </Stack>
          <ChevronRight size={14} color="#cbd5e1" />
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
            color: "#64748b",
            border: "1px solid #f1f5f9",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(239,68,68,0.06)";
            (e.currentTarget as HTMLElement).style.borderColor = "#fca5a5";
            (e.currentTarget as HTMLElement).style.color = "#ef4444";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor = "#f1f5f9";
            (e.currentTarget as HTMLElement).style.color = "#64748b";
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
      </Stack>
    </Box>
  );
}
