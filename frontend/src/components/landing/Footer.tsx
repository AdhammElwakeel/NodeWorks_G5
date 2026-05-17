import { Container, Box, Group, Text } from "@mantine/core";

export function Footer() {
  return (
    <Box
      component="footer"
      py="xl"
      style={{
        borderTop: "1px solid var(--app-border)",
        backgroundColor: "var(--app-bg)",
      }}
    >
      <Container size="xl">
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          {/* Logo */}
          <Group gap="xs" align="center" wrap="nowrap">
            <img src="/logo.svg" alt="NodeWorks" width={34} height={34} style={{ display: "block" }} />
            <Text fw={600} fz="md" c="var(--app-text-strong)" lh={1}>
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
