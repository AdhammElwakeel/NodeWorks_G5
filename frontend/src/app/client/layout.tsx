"use client";

import { useState } from "react";
import { Box, Burger, Title, Group, Drawer } from "@mantine/core";
import { ClientSidebar } from "@/components/client/ClientSidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ProtectedRoute requiredRole="client">
      <Box style={{ display: "flex", minHeight: "100vh" }}>
        {/* Desktop sidebar placeholder */}
        <Box visibleFrom="md" w={260} style={{ flexShrink: 0 }} />

        {/* Main content */}
        <Box style={{ flex: 1, minHeight: "100vh", backgroundColor: "var(--app-bg)" }}>
          {/* Mobile header */}
          <Group hiddenFrom="md" p="md" style={{ borderBottom: "1px solid var(--app-border)", background: "var(--app-surface)" }}>
            <Burger opened={mobileOpen} onClick={() => setMobileOpen((o) => !o)} size="sm" />
            <Title order={5} c="var(--app-text-strong)">NodeWorks</Title>
          </Group>

          <Box p={{ base: "md", md: 32 }}>
            {children}
          </Box>
        </Box>

        {/* Desktop sidebar */}
        <Box visibleFrom="md" style={{ position: "fixed", top: 0, left: 0, width: 260, height: "100vh", zIndex: 200 }}>
          <ClientSidebar />
        </Box>

        {/* Mobile drawer */}
        <Drawer opened={mobileOpen} onClose={() => setMobileOpen(false)} size="xs" withCloseButton={false} padding={0} hiddenFrom="md">
          <ClientSidebar />
        </Drawer>
      </Box>
    </ProtectedRoute>
  );
}
