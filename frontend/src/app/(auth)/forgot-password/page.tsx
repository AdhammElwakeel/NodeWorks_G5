"use client";

import {
  Button,
  Title,
  TextInput,
  Paper,
  Text,
  Group,
  Box,
  Stack,
  Anchor,
} from "@mantine/core";
import { Zap, Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "flex",
      }}
    >
      {/* Left Side - Branding */}
      <Box
        style={{
          flex: 1,
          background:
            "linear-gradient(135deg, var(--mantine-color-indigo-6), var(--mantine-color-blue-6))",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "var(--mantine-spacing-xl)",
          position: "relative",
          overflow: "hidden",
        }}
        visibleFrom="md"
      >
        {/* Background decoration */}
        <Box
          style={{
            position: "absolute",
            top: "-10%",
            right: "-10%",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.1)",
          }}
        />
        <Box
          style={{
            position: "absolute",
            bottom: "-15%",
            left: "-10%",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.05)",
          }}
        />

        {/* Content */}
        <Stack align="center" gap="xl" style={{ position: "relative", zIndex: 1 }}>
          {/* Logo */}
          <Group gap="sm" align="center">
            <Box
              p="md"
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                borderRadius: "var(--mantine-radius-lg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Zap size={32} color="white" fill="white" />
            </Box>
            <Text fw={700} fz={32} c="white">
              NodeWorks
            </Text>
          </Group>

          {/* Tagline */}
          <Stack gap="md" align="center" maw={400} ta="center">
            <Title order={2} c="white" fw={600}>
              Don&apos;t worry, we&apos;ve got you
            </Title>
            <Text c="white" opacity={0.9} fz="lg">
              Reset your password in just a few simple steps and get back to
              connecting with amazing opportunities.
            </Text>
          </Stack>

          {/* Security Note */}
          <Box
            p="lg"
            mt="xl"
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              borderRadius: "var(--mantine-radius-md)",
              maxWidth: 350,
            }}
          >
            <Stack gap="xs">
              <Text c="white" fw={600} fz="sm">
                Security Tips:
              </Text>
              <Text c="white" opacity={0.85} fz="xs">
                • Use a strong, unique password
              </Text>
              <Text c="white" opacity={0.85} fz="xs">
                • Never share your password with anyone
              </Text>
              <Text c="white" opacity={0.85} fz="xs">
                • Enable two-factor authentication for extra security
              </Text>
            </Stack>
          </Box>
        </Stack>
      </Box>

      {/* Right Side - Reset Form */}
      <Box
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "var(--mantine-spacing-xl)",
          backgroundColor: "var(--mantine-color-gray-0)",
        }}
      >
        {/* Mobile Logo */}
        <Group gap="xs" align="center" mb="xl" hiddenFrom="md">
          <Box
            p="xs"
            style={{
              background:
                "linear-gradient(135deg, var(--mantine-color-indigo-6), var(--mantine-color-blue-6))",
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

        <Paper
          withBorder
          shadow="sm"
          p="xl"
          radius="lg"
          maw={420}
          w="100%"
          bg="white"
        >
          <Stack gap="lg">
            {/* Header */}
            <Stack gap={4} ta="center">
              <Box
                mx="auto"
                mb="sm"
                p="md"
                style={{
                  background: "var(--mantine-color-indigo-0)",
                  borderRadius: "50%",
                  width: 64,
                  height: 64,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Mail size={28} color="var(--mantine-color-indigo-6)" />
              </Box>
              <Title order={2} fw={700}>
                Reset your password
              </Title>
              <Text c="dimmed" fz="sm">
                Enter your email and we&apos;ll send you a link to reset your
                password
              </Text>
            </Stack>

            {/* Form */}
            <form>
              <Stack gap="md">
                <TextInput
                  label="Email address"
                  placeholder="you@example.com"
                  required
                  size="md"
                  leftSection={<Mail size={18} />}
                  styles={{ label: { color: "var(--mantine-color-dark-7)" } }}
                />
                <Button
                  fullWidth
                  size="md"
                  variant="gradient"
                  gradient={{ from: "indigo", to: "blue", deg: 135 }}
                >
                  Send reset link
                </Button>
              </Stack>
            </form>

            {/* Back to login */}
            <Anchor
              component={Link}
              href="/login"
              fz="sm"
              c="dimmed"
              ta="center"
            >
              <Group gap={4} justify="center">
                <ArrowLeft size={14} />
                Back to sign in
              </Group>
            </Anchor>
          </Stack>
        </Paper>

        {/* Back to home */}
        <Anchor component={Link} href="/" fz="sm" c="dimmed" mt="xl">
          ← Back to home
        </Anchor>
      </Box>
    </Box>
  );
}
