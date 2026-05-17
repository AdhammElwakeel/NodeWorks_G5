"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Container,
  Card,
  Text,
  Title,
  Stack,
  Group,
  Badge,
  Textarea,
  NumberInput,
  TextInput,
  Button,
  Loader,
  Center,
  Divider,
  Breadcrumbs,
  Anchor,
  FileInput,
  Paper,
} from "@mantine/core";
import {
  ArrowLeft,
  Send,
  FileText,
  DollarSign,
  Clock,
  Upload,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { projectApi, proposalApi } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import type { ProjectData } from "@/lib/api";

export default function ApplyPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [coverLetter, setCoverLetter] = useState("");
  const [proposedRate, setProposedRate] = useState<number | "">("");
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [workFile, setWorkFile] = useState<File | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      try {
        const data = await projectApi.get(projectId);
        setProject(data.project || data);
      } catch {
        notifications.show({
          title: "Error",
          message: "Failed to load project details.",
          color: "red",
        });
      } finally {
        setLoading(false);
      }
    };
    loadProject();
  }, [projectId]);

  const handleSubmit = async () => {
    if (!coverLetter.trim() || !proposedRate) return;
    setSubmitting(true);
    setError(null);
    try {
      await proposalApi.create({
        projectId,
        coverLetter: coverLetter.trim(),
        proposedRate: Number(proposedRate),
        estimatedDuration: estimatedDuration.trim() || undefined,
      });
      notifications.show({
        title: "Proposal submitted!",
        message: "Your proposal has been sent to the client.",
        color: "green",
      });
      router.push("/freelancer/dashboard");
    } catch (err: any) {
      setError(err?.message || "Failed to submit proposal. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole="freelancer">
        <Center style={{ minHeight: "100vh" }}>
          <Loader size="lg" color="cyan" />
        </Center>
      </ProtectedRoute>
    );
  }

  if (!project) {
    return (
      <ProtectedRoute requiredRole="freelancer">
        <Center style={{ minHeight: "100vh" }}>
          <Text c="dimmed">Project not found.</Text>
        </Center>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="freelancer">
      <Box style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
        <Container size="md" py="xl">
          <Stack gap="lg">
            <Breadcrumbs mb="xs">
              <Anchor component={Link} href="/freelancer/dashboard" size="sm" c="dimmed">
                Dashboard
              </Anchor>
              <Text size="sm" c="dark">
                Apply
              </Text>
            </Breadcrumbs>

            <Group>
              <Button
                variant="subtle"
                color="gray"
                leftSection={<ArrowLeft size={16} />}
                component={Link}
                href="/freelancer/dashboard"
              >
                Back to Jobs
              </Button>
            </Group>

            <Paper withBorder radius="md" shadow="sm" p="xl" bg="white">
              <Stack gap="md">
                <Group gap="sm">
                  <Briefcase size={24} color="var(--mantine-color-cyan-6)" />
                  <Title order={3} c="dark">
                    Apply for Job
                  </Title>
                </Group>
                <Divider />

                <Text fw={700} fz="xl" c="dark">
                  {project.title}
                </Text>
                <Text c="dimmed" style={{ lineHeight: 1.6 }}>
                  {project.description}
                </Text>

                <Group gap="sm" wrap="wrap">
                  {project.skills?.map((s: string) => (
                    <Badge
                      key={s}
                      size="sm"
                      variant="light"
                      color="cyan"
                      radius="sm"
                    >
                      {s}
                    </Badge>
                  ))}
                </Group>

                <Group gap="lg">
                  {project.budget && (
                    <Group gap={4}>
                      <DollarSign size={16} color="var(--mantine-color-cyan-6)" />
                      <Text fw={600} fz="sm" c="dark">
                        Budget: ${project.budget.toLocaleString()}
                      </Text>
                    </Group>
                  )}
                  {project.timeline && (
                    <Group gap={4}>
                      <Clock size={16} color="var(--mantine-color-gray-5)" />
                      <Text fz="sm" c="dimmed">
                        {project.timeline}
                      </Text>
                    </Group>
                  )}
                </Group>
              </Stack>
            </Paper>

            <Paper withBorder radius="md" shadow="sm" p="xl" bg="white">
              <Stack gap="md">
                <Title order={4} c="dark">
                  Your Proposal
                </Title>
                <Divider />

                <Textarea
                  label="Cover Letter"
                  placeholder="Introduce yourself and explain why you're the best fit for this job..."
                  required
                  minRows={6}
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  styles={{ label: { fontWeight: 600, color: "var(--mantine-color-dark-9)" } }}
                />

                <Group grow>
                  <NumberInput
                    label="Proposed Rate (USD)"
                    placeholder="e.g. 5000"
                    required
                    min={1}
                    value={proposedRate}
                    onChange={(val) => setProposedRate(val as number | "")}
                    prefix="$"
                    leftSection={<DollarSign size={16} />}
                    styles={{ label: { fontWeight: 600, color: "var(--mantine-color-dark-9)" } }}
                  />
                  <TextInput
                    label="Estimated Duration"
                    placeholder="e.g. 2 weeks"
                    value={estimatedDuration}
                    onChange={(e) => setEstimatedDuration(e.target.value)}
                    leftSection={<Clock size={16} />}
                    styles={{ label: { fontWeight: 600, color: "var(--mantine-color-dark-9)" } }}
                  />
                </Group>

                <FileInput
                  label="Portfolio / Past Work (PDF)"
                  placeholder="Upload a PDF of your past work or portfolio"
                  accept="application/pdf"
                  value={workFile}
                  onChange={setWorkFile}
                  leftSection={<Upload size={16} />}
                  clearable
                  description="Optional: attach examples of your previous work"
                  styles={{ label: { fontWeight: 600, color: "var(--mantine-color-dark-9)" } }}
                />

                {error && (
                  <Text c="red" fz="sm" ta="center">
                    {error}
                  </Text>
                )}

                <Group justify="flex-end" mt="sm">
                  <Button
                    variant="default"
                    component={Link}
                    href="/freelancer/dashboard"
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="cyan"
                    onClick={handleSubmit}
                    loading={submitting}
                    disabled={!coverLetter.trim() || !proposedRate || submitting}
                    leftSection={<Send size={16} />}
                  >
                    Submit Proposal
                  </Button>
                </Group>
              </Stack>
            </Paper>
          </Stack>
        </Container>
      </Box>
    </ProtectedRoute>
  );
}
