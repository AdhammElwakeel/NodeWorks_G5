"use client";

import { Group, Button, Container, Text, Box, useMantineColorScheme } from "@mantine/core";
import { Zap } from "lucide-react";
import Link from "next/link";

export function Navbar() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  return (
    <Box
      component="header"
      py="md"
      style={{
        borderBottom: isDark ? "1px solid var(--mantine-color-dark-4)" : "1px solid var(--mantine-color-gray-2)",
        backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(8px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <Container size="xl">
        <Group justify="space-between" align="center">
          {/* Logo */}
          <Group gap="xs" align="center">
            <Box
              p="xs"
              style={{
                background: "linear-gradient(135deg, var(--mantine-color-indigo-6), var(--mantine-color-blue-6))",
                borderRadius: "var(--mantine-radius-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={20} color="white" fill="white" />
            </Box>
            <Text fw={700} fz="xl" c="dark">
              NodeWorks
            </Text>
          </Group>

          {/* Navigation Buttons */}
          <Group gap="sm">
            <Button
              component={Link}
              href="/login"
              variant="subtle"
              color="gray"
              size="md"
            >
              Sign In
            </Button>
            <Button
              component={Link}
              href="/register"
              variant="gradient"
              gradient={{ from: "indigo", to: "blue", deg: 135 }}
              size="md"
            >
              Get Started
            </Button>
          </Group>
        </Group>
      </Container>
    </Box>
  );
}
