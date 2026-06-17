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
  Text,
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

function MagicWindIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
    </svg>
  );
}

export default function CreateProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState<number | "">("");
  const [skills, setSkills] = useState<string[]>([]);
  const [timeline, setTimeline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionsGenerated, setSuggestionsGenerated] = useState(false);
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const skillOptions = Array.from(
    new Set([...SKILL_OPTIONS, ...skills, ...suggestedSkills])
  );

  const addSkill = (skill: string) => {
    const normalized = skill.trim();
    if (!normalized) return;

    setSkills((current) => {
      if (current.some((item) => item.toLowerCase() === normalized.toLowerCase())) {
        return current;
      }

      return [...current, normalized];
    });
    setSuggestedSkills((current) =>
      current.filter((item) => item.toLowerCase() !== normalized.toLowerCase())
    );
  };

  const handleSuggestSkills = async () => {
    if (suggestionsGenerated) return;

    if (!title.trim() || !description.trim()) {
      setSuggestionError("Add a project title and description first.");
      return;
    }

    setSuggesting(true);
    setSuggestionError(null);

    try {
      const result = await projectApi.suggestSkills({
        title: title.trim(),
        description: description.trim(),
        skills,
      });

      const existing = new Set(skills.map((skill) => skill.toLowerCase()));
      const suggestions = (result.skills || []).filter(
        (skill) => !existing.has(skill.toLowerCase())
      );
      setSuggestedSkills(suggestions);
      setSuggestionsGenerated(true);

      notifications.show({
        title: suggestions.length ? "Skills suggested" : "No new skills found",
        message: suggestions.length
          ? "Click any suggestion to add it to required skills."
          : "The selected skills already cover the project well.",
        color: suggestions.length ? "violet" : "yellow",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to suggest skills. Please try again.";
      setSuggestionError(message);
    } finally {
      setSuggesting(false);
    }
  };

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
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create project. Please try again."
      );
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

      <Title order={2} c="var(--app-text-strong)" mb="lg">
        Create New Project
      </Title>

      <Card
        className="client-project-form"
        withBorder
        radius="md"
        bg="var(--app-surface)"
        p="xl"
      >
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
                label: { color: "var(--app-text)", fontWeight: 600 },
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
                label: { color: "var(--app-text)", fontWeight: 600 },
              }}
            />

            <Card withBorder radius="md" bg="var(--app-bg)" p="md">
              <Group justify="space-between" align="center" gap="md">
                <Box>
                  <Text fw={700} c="var(--app-text-strong)">
                    Not sure which freelancer skills are needed?
                  </Text>
                  <Text fz="sm" c="var(--app-text-muted)">
                    Let AI read the title and description, then suggest skills you can add.
                  </Text>
                </Box>
                <Button
                  type="button"
                  variant="light"
                  color="violet"
                  radius="md"
                  leftSection={
                    suggesting ? <Loader size={14} /> : <MagicWindIcon size={16} />
                  }
                  onClick={handleSuggestSkills}
                  disabled={
                    !title.trim() ||
                    !description.trim() ||
                    suggesting ||
                    suggestionsGenerated
                  }
                >
                  {suggesting
                    ? "Checking..."
                    : suggestionsGenerated
                      ? "Suggestions generated"
                      : "Suggest skills"}
                </Button>
              </Group>

              {suggestionError && (
                <Text c="red" fz="sm" mt="sm">
                  {suggestionError}
                </Text>
              )}

              {suggestedSkills.length > 0 && (
                <Box mt="md">
                  <Text fz="sm" fw={600} c="var(--app-text)" mb="xs">
                    Suggested skills
                  </Text>
                  <Group gap="xs">
                    {suggestedSkills.map((skill) => (
                      <Button
                        key={skill}
                        type="button"
                        size="xs"
                        variant="light"
                        color="teal"
                        radius="xl"
                        onClick={() => addSkill(skill)}
                      >
                        + {skill}
                      </Button>
                    ))}
                  </Group>
                </Box>
              )}
            </Card>

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
                    color: "var(--app-text)",
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
                    color: "var(--app-text)",
                    fontWeight: 600,
                  },
                }}
              />
            </Group>

            <TagsInput
              label="Required Skills"
              placeholder="Type a skill and press Enter"
              data={skillOptions}
              value={skills}
              onChange={setSkills}
              clearable
              required
              styles={{
                label: { color: "var(--app-text)", fontWeight: 600 },
                option: { color: "var(--app-text)" },
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
                color="teal"
                variant="filled"
                radius="md"
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
