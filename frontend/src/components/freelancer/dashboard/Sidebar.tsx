"use client";

import { useState, type ReactNode } from "react";
import {
  Box,
  Text,
  Stack,
  Avatar,
  Divider,
  useMantineColorScheme,
} from "@mantine/core";
import {
  Home,
  Briefcase,
  Wallet,
  Moon,
  Sun,
  Settings,
  Bell,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
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
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isProfileActive = pathname === "/freelancer/profile";
  const isBrowseActive = pathname === "/freelancer/jobs";

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
      label: "Earning",
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
    router.push("/freelancer/profile");
  };

  const COLLAPSED_WIDTH = 80;
  const EXPANDED_WIDTH = 260;
  const RAIL_CENTER_X = COLLAPSED_WIDTH / 2;
  const SIDE_PADDING = 16;
  const LOGO_SIZE = 34;
  const NAV_ICON_SIZE = 28;
  const logoLeft = RAIL_CENTER_X - LOGO_SIZE / 2;
  const navIconLeft = RAIL_CENTER_X - SIDE_PADDING - NAV_ICON_SIZE / 2;
  const sidebarWidth = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  const bottomItem = ({
    icon,
    label,
    onClick,
    active = false,
  }: {
    icon: ReactNode;
    label: string;
    onClick?: () => void;
    active?: boolean;
  }) => (
    <Box
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: isExpanded ? 14 : 0,
        padding: isExpanded
          ? `10px 14px 10px ${navIconLeft}px`
          : `10px 0 10px ${navIconLeft}px`,
        borderRadius: 12,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease",
        width: "100%",
        color: active ? "var(--app-text)" : "var(--app-muted)",
        backgroundColor: active ? "var(--app-active-bg)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (!active && onClick) {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            "var(--app-hover-soft)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active && onClick) {
          (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
        }
      }}
    >
      <Box
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 28,
          height: 28,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      {isExpanded && (
        <Text fz="sm" fw={active ? 600 : 500} style={{ flex: 1 }}>
          {label}
        </Text>
      )}
    </Box>
  );

  return (
    <Box
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        height: "100vh",
        backgroundColor: "var(--app-sidebar)",
        borderRight: "1px solid var(--app-border-subtle)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        boxShadow: isExpanded
          ? "var(--app-sidebar-shadow)"
          : "var(--app-sidebar-shadow-collapsed)",
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Logo */}
      <Box
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 12,
          padding: `16px ${SIDE_PADDING}px 16px ${logoLeft}px`,
          minHeight: 72,
        }}
      >
        <Box
          onClick={() => router.push("/freelancer/dashboard")}
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <img
            src="/logo.svg"
            alt="NodeWorks"
            width={34}
            height={34}
            style={{ display: "block" }}
          />
        </Box>
      </Box>

      <Divider mx="lg" color="var(--app-border-subtle)" />

      {/* Navigation */}
      <Stack gap={4} px={SIDE_PADDING} pt="sm" flex={1}>
        {navItems.map((item) => (
          <Box
            key={item.section}
            onClick={() => handleNavClick(item.section)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: isExpanded ? 14 : 0,
              padding: isExpanded
                ? `12px 14px 12px ${navIconLeft}px`
                : `10px 0 10px ${navIconLeft}px`,
              borderRadius: 12,
              cursor: "pointer",
              transition: "all 0.2s ease",
              position: "relative",
              overflow: "hidden",
              backgroundColor: item.active
                ? "var(--app-active-bg)"
                : "transparent",
              color: item.active
                ? "var(--app-text)"
                : "var(--app-muted)",
            }}
            onMouseEnter={(e) => {
              if (!item.active) {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "var(--app-hover-soft)";
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
      <Box p={SIDE_PADDING}>
        <Divider color="var(--app-border-subtle)" mb="sm" />

        <Stack gap="xs" align="flex-start">
          {bottomItem({ icon: <Bell size={20} />, label: "Notifications" })}
          {bottomItem({ icon: <Settings size={20} />, label: "Settings" })}
          {bottomItem({
            icon: isDark ? <Sun size={20} /> : <Moon size={20} />,
            label: "Dark mode",
            onClick: () => setColorScheme(isDark ? "light" : "dark"),
          })}
          {bottomItem({
            icon: (
              <Avatar
                size={28}
                radius="xl"
                color="cyan"
                style={{
                  border: isProfileActive
                    ? "2px solid rgba(6,182,212,0.4)"
                    : "2px solid rgba(6,182,212,0.2)",
                  flexShrink: 0,
                }}
              >
                {initials}
              </Avatar>
            ),
            label: "Profile",
            onClick: handleProfileClick,
            active: isProfileActive,
          })}
          {bottomItem({
            icon: <LogOut size={20} />,
            label: "Sign out",
            onClick: logout,
          })}
        </Stack>
      </Box>
    </Box>
  );
}
