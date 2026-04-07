import { Container, Box, Group, Text } from "@mantine/core";
import { Zap } from "lucide-react";

export function Footer() {
  return (
    <Box
      component="footer"
      py="xl"
      style={{
        borderTop: "1px solid var(--mantine-color-gray-2)",
        backgroundColor: "var(--mantine-color-gray-0)",
      }}
    >
      <Container size="xl">
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          {/* Logo */}
          <Group gap="xs" align="center">
            <Box
              p={6}
              style={{
                background: "linear-gradient(135deg, var(--mantine-color-indigo-6), var(--mantine-color-blue-6))",
                borderRadius: "var(--mantine-radius-sm)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={16} color="white" fill="white" />
            </Box>
            <Text fw={600} fz="md" c="dark">
              NodeWorks
            </Text>
          </Group>

          {/* Copyright */}
          <Text fz="sm" c="dimmed">
            © 2026 NodeWorks. All rights reserved.
          </Text>
        </Group>
      </Container>
    </Box>
  );
}
