"use client";

import { Group, Button, Container, Text, Box } from "@mantine/core";
import { Zap } from "lucide-react";
import Link from "next/link";

export function Navbar() {
  return (
    <Box
      component="header"
      py="md"
      style={{
        borderBottom: "1px solid var(--mantine-color-gray-2)",
        backgroundColor: "rgba(255, 255, 255, 0.9)",
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
              href="/register?role=client"
              variant="subtle"
              color="gray"
              size="md"
            >
              Hire Talent
            </Button>
            <Button
              component={Link}
              href="/register"
              variant="default"
              size="md"
            >
              Find Work
            </Button>
            <Button
              component={Link}
              href="/login"
              variant="subtle"
              color="gray"
              size="md"
            >
              Sign In
            </Button>
          </Group>
        </Group>
      </Container>
    </Box>
  );
}
