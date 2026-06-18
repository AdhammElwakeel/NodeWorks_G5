"use client";

import { Box, Text, Stack, Group, Avatar, Divider } from "@mantine/core";
import { LayoutDashboard, FolderOpen, PlusCircle, MessageSquare, ChevronRight, LogOut, Building2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  active: boolean;
}

function NavItem({ icon, label, href, active }: NavItemProps) {
  return (
    <Box
      component={Link}
      href={href}
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
        backgroundColor: active ? "var(--app-active-bg)" : "transparent",
        color: active ? "var(--app-text)" : "var(--app-muted)",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--app-hover-soft)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
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
      <Box style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, color: active ? "#06b6d4" : "inherit", transition: "color 0.2s", flexShrink: 0 }}>
        {icon}
      </Box>
      <Text fz="sm" fw={active ? 600 : 500} style={{ flex: 1, letterSpacing: "-0.01em" }}>
        {label}
      </Text>
    </Box>
  );
}

export function ClientSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const displayName = user?.name || "Your Company";
  const displayRole = user?.role === "client" ? "Client Account" : "Account";

  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: "Dashboard", href: "/client/dashboard" },
    { icon: <FolderOpen size={20} />, label: "My Projects", href: "/client/projects" },
    { icon: <PlusCircle size={20} />, label: "Create Project", href: "/client/projects/new" },
    { icon: <MessageSquare size={20} />, label: "Inbox", href: "/client/messages" },
  ];

  function isNavActive(href: string) {
    if (href === "/client/projects") {
      return pathname === href || (pathname.startsWith("/client/projects/") && pathname !== "/client/projects/new");
    }

    if (href === "/client/projects/new") {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <Box
      style={{
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--app-sidebar)",
        borderRight: "1px solid var(--app-border-subtle)",
      }}
    >
      {/* Logo */}
      <Box p="lg" pb="sm">
        <Group gap="sm" align="center" wrap="nowrap">
          <img src="/logo.svg" alt="NodeWorks" width={34} height={34} style={{ display: "block" }} />
          <Stack gap={0}>
            <Text fw={700} fz="lg" c="var(--app-text-strong)" lh={1.2}>NodeWorks</Text>
            <Text fz={10} c="var(--app-muted-soft)" fw={600} tt="uppercase" lh={1}>Client</Text>
          </Stack>
        </Group>
      </Box>

      <Divider mx="lg" color="var(--app-border-subtle)" />

      {/* Nav */}
      <Stack gap={4} px="md" pt="lg" flex={1}>
        <Text fz={11} fw={700} tt="uppercase" c="var(--app-muted-soft)" mb={4} ml={14} style={{ letterSpacing: "0.08em" }}>
          Menu
        </Text>
        {navItems.map((item) => (
          <NavItem key={item.href} {...item} active={isNavActive(item.href)} />
        ))}
      </Stack>

      {/* Bottom: Profile + Sign Out */}
      <Stack gap="sm" p="md">
        <Divider color="var(--app-border-subtle)" />

        {/* Profile Card — linked to profile page */}
        <Box
          component={Link}
          href="/client/profile"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 12,
            cursor: "pointer",
            transition: "all 0.2s ease",
            backgroundColor: pathname === "/client/profile" ? "var(--app-active-bg)" : "transparent",
            border: pathname === "/client/profile" ? "1px solid var(--app-active-border)" : "1px solid var(--app-border-subtle)",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => {
            if (pathname !== "/client/profile") {
              (e.currentTarget as HTMLElement).style.backgroundColor = "var(--app-hover-soft)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--app-border)";
            }
          }}
          onMouseLeave={(e) => {
            if (pathname !== "/client/profile") {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--app-border-subtle)";
            }
          }}
        >
          <Box style={{ position: "relative" }}>
            <Avatar size={38} radius="xl" color="indigo" style={{ border: "2px solid rgba(99,102,241,0.2)" }}>
              <Building2 size={18} />
            </Avatar>
            <Box style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: "#22c55e", border: "2px solid var(--app-sidebar)" }} />
          </Box>
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text fw={600} fz="sm" c="var(--app-text)" lineClamp={1}>{displayName}</Text>
            <Text fz={11} c="var(--app-muted-soft)" lineClamp={1}>{displayRole}</Text>
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
            color: "var(--app-muted)",
            border: "1px solid var(--app-border-subtle)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(239,68,68,0.06)";
            (e.currentTarget as HTMLElement).style.borderColor = "#fca5a5";
            (e.currentTarget as HTMLElement).style.color = "#ef4444";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--app-border-subtle)";
            (e.currentTarget as HTMLElement).style.color = "var(--app-muted)";
          }}
        >
          <Box style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            <LogOut size={16} />
          </Box>
          <Text fz="sm" fw={500} style={{ flex: 1 }}>Sign out</Text>
        </Box>
      </Stack>
    </Box>
  );
}
