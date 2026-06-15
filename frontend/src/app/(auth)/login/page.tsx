"use client";

import { Suspense } from "react";
import {
  Button,
  Title,
  TextInput,
  PasswordInput,
  Paper,
  Text,
  Group,
  Box,
  Stack,
  Divider,
  Anchor,
  Checkbox,
} from "@mantine/core";
import { Mail, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEmailError(null);

    if (!email.trim().includes("@")) {
      setEmailError("Please enter a valid email address that contains @.");
      return;
    }

    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      const redirect = searchParams.get("redirect");
      if (redirect) {
        router.push(decodeURIComponent(redirect));
      } else if (user.role === "client") {
        router.push("/client/dashboard");
      } else {
        router.push("/freelancer/dashboard");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };
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
        <Stack
          align="center"
          gap="xl"
          style={{ position: "relative", zIndex: 1 }}
        >
          {/* Logo */}
          <Group gap="sm" align="center" wrap="nowrap">
            <Image
              src="/logo.svg"
              alt="NodeWorks"
              width={34}
              height={34}
              style={{ display: "block" }}
            />
            <Text fw={700} fz={32} c="white" lh={1}>
              NodeWorks
            </Text>
          </Group>

          {/* Tagline */}
          <Stack gap="md" align="center" maw={400} ta="center">
            <Title order={2} c="white" fw={600}>
              Connect with top talent worldwide
            </Title>
            <Text c="white" opacity={0.9} fz="lg">
              Join thousands of freelancers and clients building the future of
              work together.
            </Text>
          </Stack>

          {/* Stats */}
          <Group gap={60} mt="xl">
            <Stack gap={4} align="center">
              <Text c="white" fw={700} fz={28}>
                10K+
              </Text>
              <Text c="white" opacity={0.8} fz="sm">
                Freelancers
              </Text>
            </Stack>
            <Stack gap={4} align="center">
              <Text c="white" fw={700} fz={28}>
                5K+
              </Text>
              <Text c="white" opacity={0.8} fz="sm">
                Clients
              </Text>
            </Stack>
            <Stack gap={4} align="center">
              <Text c="white" fw={700} fz={28}>
                95%
              </Text>
              <Text c="white" opacity={0.8} fz="sm">
                Match Rate
              </Text>
            </Stack>
          </Group>
        </Stack>
      </Box>

      {/* Right Side - Login Form */}
      <Box
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "var(--mantine-spacing-xl)",
          backgroundColor: "var(--app-bg)",
        }}
      >
        {/* Mobile Logo */}
        <Group gap="xs" align="center" mb="xl" hiddenFrom="md" wrap="nowrap">
          <Image
            src="/logo.svg"
            alt="NodeWorks"
            width={34}
            height={34}
            style={{ display: "block" }}
          />
          <Text fw={700} fz="xl" c="var(--app-text-strong)" lh={1}>
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
          bg="var(--app-surface)"
        >
          <Stack gap="lg">
            {/* Header */}
            <Stack gap={4} ta="center">
              <Title order={2} fw={700} c="var(--app-text-strong)">
                Welcome back
              </Title>
              <Text c="dimmed" fz="sm">
                Sign in to your account to continue
              </Text>
            </Stack>

            {/* Social Login */}
            <Stack gap="sm">
              <Button
                variant="default"
                fullWidth
                leftSection={
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                }
                size="md"
              >
                Continue with Google
              </Button>
            </Stack>

            <Divider label="or continue with email" labelPosition="center" />

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <TextInput
                  label="Email"
                  placeholder="you@example.com"
                  required
                  size="md"
                  leftSection={<Mail size={18} />}
                  value={email}
                  error={emailError}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  styles={{ label: { color: "var(--app-text)" } }}
                />
                <PasswordInput
                  label="Password"
                  placeholder="Enter your password"
                  required
                  size="md"
                  leftSection={<Lock size={18} />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  styles={{ label: { color: "var(--app-text)" } }}
                />
                <Group justify="space-between">
                  <Checkbox label="Remember me" size="sm" c="var(--app-text)" />
                  <Anchor
                    component={Link}
                    href="/forgot-password"
                    fz="sm"
                    c="indigo"
                  >
                    Forgot password?
                  </Anchor>
                </Group>
                {error && (
                  <Text c="red" fz="sm" ta="center">
                    {error}
                  </Text>
                )}
                <Button
                  fullWidth
                  size="md"
                  variant="gradient"
                  gradient={{ from: "indigo", to: "blue", deg: 135 }}
                  mt="sm"
                  type="submit"
                  loading={loading}
                >
                  Sign in
                </Button>
              </Stack>
            </form>

            {/* Footer */}
            <Text ta="center" fz="sm" c="dimmed">
              Don&apos;t have an account?{" "}
              <Anchor component={Link} href="/register" fw={500} c="indigo">
                Create one
              </Anchor>
            </Text>
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
