"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Card,
  Stack,
  TextInput,
  Textarea,
  NumberInput,
  TagsInput,
  Group,
  Title,
  Loader,
} from "@mantine/core";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notifications } from "@mantine/notifications";
import { projectApi } from "@/lib/api";

const SKILL_OPTIONS = [
  "React",
  "Next.js",
  "Node.js",
  "TypeScript",
  "UI Design",
  "Figma",
  "Python",
  "Data Analysis",
  "Content Writing",
  "Mobile Design",
  "Stripe",
  "MongoDB",
  "PostgreSQL",
  "AWS",
  "DevOps",
  "Machine Learning",
  "D3.js",
  "Tailwind",
  "REST API",
  "Webhooks",
];

export default function CreateProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState<number | "">("");
  const [skills, setSkills] = useState<string[]>([]);
  const [timeline, setTimeline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !budget || skills.length === 0) return;

    setSubmitting(true);
    setError(null);
    try {
      await projectApi.create({
        title,
        description,
        budget: Number(budget),
        skills,
        timeline: timeline || undefined,
      });
      notifications.show({
        title: "Project created",
        message: `"${title}" has been posted successfully.`,
        color: "green",
      });
      router.push("/client/projects");
    } catch (err: any) {
      setError(err?.message || "Failed to create project. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Group mb="xl">
        <Button
          component={Link}
          href="/client/projects"
          variant="subtle"
          leftSection={<ArrowLeft size={16} />}
          size="sm"
        >
          Back to projects
        </Button>
      </Group>

      <Title order={2} c="dark.9" mb="lg">
        Create New Project
      </Title>

      <Card withBorder radius="md" bg="white" p="xl">
        <form onSubmit={handleSubmit}>
          <Stack gap="lg">
            <TextInput
              label="Project Title"
              placeholder="e.g. Build a modern e-commerce website"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              size="md"
              styles={{
                label: { color: "var(--mantine-color-dark-9)", fontWeight: 600 },
              }}
            />

            <Textarea
              label="Description"
              placeholder="Describe what you need, requirements, deliverables..."
              required
              minRows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              styles={{
                label: { color: "var(--mantine-color-dark-9)", fontWeight: 600 },
              }}
            />

            <Group grow>
              <NumberInput
                label="Budget (USD)"
                placeholder="5000"
                required
                min={100}
                value={budget}
                onChange={(val) => setBudget(val as number | "")}
                prefix="$"
                styles={{
                  label: {
                    color: "var(--mantine-color-dark-9)",
                    fontWeight: 600,
                  },
                }}
              />
              <TextInput
                label="Timeline / Duration"
                placeholder="e.g. 4 weeks"
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                styles={{
                  label: {
                    color: "var(--mantine-color-dark-9)",
                    fontWeight: 600,
                  },
                }}
              />
            </Group>

            <TagsInput
              label="Required Skills"
              placeholder="Type a skill and press Enter"
              data={SKILL_OPTIONS}
              value={skills}
              onChange={setSkills}
              clearable
              required
              styles={{
                label: { color: "var(--mantine-color-dark-9)", fontWeight: 600 },
                option: { color: "var(--mantine-color-dark-9)" },
                pill: {
                  backgroundColor: "var(--mantine-color-indigo-6)",
                  color: "white",
                },
              }}
            />

            {error && (
              <Text c="red" fz="sm" ta="center">
                {error}
              </Text>
            )}

            <Group justify="flex-end" mt="md">
              <Button
                component={Link}
                href="/client/projects"
                variant="default"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="gradient"
                gradient={{ from: "indigo", to: "cyan", deg: 135 }}
                leftSection={
                  submitting ? <Loader size={14} color="white" /> : <Save size={16} />
                }
                disabled={
                  !title ||
                  !description ||
                  !budget ||
                  skills.length === 0 ||
                  submitting
                }
              >
                {submitting ? "Creating..." : "Create Project"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Box>
  );
}