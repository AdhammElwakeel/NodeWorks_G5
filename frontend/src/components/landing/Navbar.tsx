"use client";

import Image from "next/image";
import { Group, Button, Container, Text, Box } from "@mantine/core";
import Link from "next/link";

export function Navbar() {
  return (
    <Box
      component="header"
      py="md"
      style={{
        borderBottom: "1px solid var(--app-border)",
        backgroundColor: "color-mix(in srgb, var(--app-surface) 90%, transparent)",
        backdropFilter: "blur(8px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <Container size="xl">
        <Group justify="space-between" align="center">
          {/* Logo */}
          <Group gap="xs" align="center" wrap="nowrap">
            <Image src="/logo.svg" alt="NodeWorks" width={34} height={34} style={{ display: "block" }} />
            <Text fw={700} fz="xl" c="var(--app-text-strong)" lh={1}>
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
