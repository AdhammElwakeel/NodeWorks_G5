"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea,
  NumberInput,
  Select,
  TagsInput,
  Title,
  Loader,
  Center,
} from "@mantine/core";
import {
  User,
  Save,
  ArrowLeft,
  MapPin,
  DollarSign,
  Globe,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";
import { profileApi } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import Link from "next/link";

const EXPERIENCE_LEVELS = ["Junior", "Mid-level", "Senior", "Lead"];
const AVAILABILITY_OPTIONS = ["Full-time", "Part-time", "As needed", "Not available"];

const SKILL_OPTIONS = [
  "React", "Next.js", "Node.js", "TypeScript", "JavaScript",
  "Python", "Django", "Flask", "FastAPI",
  "Vue.js", "Angular", "Svelte",
  "React Native", "Flutter", "Swift", "Kotlin",
  "PostgreSQL", "MongoDB", "MySQL", "Redis",
  "AWS", "Docker", "Kubernetes", "CI/CD",
  "UI Design", "UX Design", "Figma",
  "Project Management", "Agile", "Scrum",
  "Data Analysis", "Machine Learning", "AI",
  "Content Writing", "SEO", "Marketing",
  "DevOps", "Linux", "Shell Scripting",
];

export default function EditProfilePage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    headline: "",
    about: "",
    country: "",
    hourlyRate: 0,
    experienceLevel: "",
    availability: "",
    skills: [] as string[],
    portfolioLinks: [] as string[],
  });

  useEffect(() => {
    if (!user) return;
    const fp = (user as any).freelancerProfile || {};
    setForm({
      name: user.name || "",
      headline: fp.headline || user.name || "",
      about: fp.about || "",
      country: fp.country || "",
      hourlyRate: fp.hourlyRate || 0,
      experienceLevel: fp.experienceLevel || "",
      availability: fp.availability || "",
      skills: fp.skills || [],
      portfolioLinks: fp.portfolioLinks || [],
    });
    setLoading(false);
  }, [user]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const getMissingFields = () => {
    const missing: string[] = [];
    if (!form.name.trim()) missing.push("full name");
    if (!form.headline.trim()) missing.push("headline");
    if (!form.about.trim()) missing.push("about you");
    if (!form.country.trim()) missing.push("country");
    if (!form.hourlyRate || form.hourlyRate <= 0) missing.push("hourly rate");
    if (!form.experienceLevel) missing.push("experience level");
    if (!form.availability) missing.push("availability");
    if (form.skills.length === 0) missing.push("skills");
    return missing;
  };

  const handleSave = async () => {
    const missingFields = getMissingFields();
    if (missingFields.length > 0) {
      notifications.show({
        title: "Complete required profile fields",
        message: `Missing: ${missingFields.join(", ")}`,
        color: "orange",
      });
      return;
    }

    setSaving(true);
    try {
      await profileApi.update({
        name: form.name,
        profile: {
          headline: form.headline,
          about: form.about,
          country: form.country,
          hourlyRate: form.hourlyRate,
          experienceLevel: form.experienceLevel,
          availability: form.availability,
          skills: form.skills,
          portfolioLinks: form.portfolioLinks,
        },
      });
      await refreshUser();
      notifications.show({
        title: "Profile saved",
        message: "Your profile has been updated successfully.",
        color: "green",
      });
      router.push("/freelancer/profile");
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to save profile. Please try again.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole="freelancer">
        <Center style={{ minHeight: "80vh" }}>
          <Loader size="lg" color="indigo" />
        </Center>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="freelancer">
      <Box
        style={{
          minHeight: "100vh",
          backgroundColor: "var(--app-bg)",
          padding: "32px 24px",
        }}
      >
        <Box maw={800} mx="auto">
          <Group mb="lg">
            <Button
              component={Link}
              href="/freelancer/profile"
              variant="subtle"
              leftSection={<ArrowLeft size={16} />}
              size="sm"
            >
              Back to profile
            </Button>
          </Group>

          <Group mb="xl" justify="space-between" align="center">
            <Group gap="sm">
              <User size={28} color="#4f46e5" />
              <Stack gap={0}>
                <Title order={2} c="var(--app-text-strong)">Edit Profile</Title>
                <Text fz="sm" c="dimmed">Update your freelancer information</Text>
              </Stack>
            </Group>
            <Button
              variant="gradient"
              gradient={{ from: "indigo", to: "cyan", deg: 135 }}
              leftSection={<Save size={16} />}
              onClick={handleSave}
              loading={saving}
            >
              Save Changes
            </Button>
          </Group>

          <Card withBorder radius="md" bg="var(--app-surface)" mb="md">
            <Text fw={600} c="var(--app-text)" mb="md">Basic Information</Text>
            <Stack gap="md">
              <TextInput
                label="Full Name"
                placeholder="Your full name"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                styles={{ label: { fontWeight: 600 } }}
              />
              <TextInput
                label="Professional Headline"
                placeholder="e.g. Full-Stack Developer specializing in SaaS"
                required
                value={form.headline}
                onChange={(e) => update("headline", e.target.value)}
                styles={{ label: { fontWeight: 600 } }}
              />
              <Textarea
                label="About You"
                placeholder="Tell clients about your expertise, experience, and what makes you great at what you do..."
                required
                minRows={5}
                value={form.about}
                onChange={(e) => update("about", e.target.value)}
                styles={{ label: { fontWeight: 600 } }}
              />
            </Stack>
          </Card>

          <Card withBorder radius="md" bg="var(--app-surface)" mb="md">
            <Text fw={600} c="var(--app-text)" mb="md">Location & Rate</Text>
            <Group grow>
              <TextInput
                label="Country"
                placeholder="e.g. Egypt"
                required
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                leftSection={<MapPin size={16} color="var(--app-muted-soft)" />}
                styles={{ label: { fontWeight: 600 } }}
              />
              <NumberInput
                label="Hourly Rate (USD)"
                placeholder="e.g. 50"
                required
                value={form.hourlyRate}
                onChange={(v) => update("hourlyRate", typeof v === "number" ? v : 0)}
                min={1}
                leftSection={<DollarSign size={16} color="var(--app-muted-soft)" />}
                styles={{ label: { fontWeight: 600 } }}
              />
            </Group>
          </Card>

          <Card withBorder radius="md" bg="var(--app-surface)" mb="md">
            <Text fw={600} c="var(--app-text)" mb="md">Experience & Availability</Text>
            <Group grow>
              <Select
                label="Experience Level"
                placeholder="Select level"
                data={EXPERIENCE_LEVELS}
                required
                value={form.experienceLevel}
                onChange={(v) => update("experienceLevel", v || "")}
                styles={{ label: { fontWeight: 600 } }}
              />
              <Select
                label="Availability"
                placeholder="Select availability"
                data={AVAILABILITY_OPTIONS}
                required
                value={form.availability}
                onChange={(v) => update("availability", v || "")}
                styles={{ label: { fontWeight: 600 } }}
              />
            </Group>
          </Card>

          <Card withBorder radius="md" bg="var(--app-surface)" mb="md">
            <Text fw={600} c="var(--app-text)" mb="md">Skills</Text>
            <TagsInput
              label="Your Skills"
              placeholder="Type a skill and press Enter"
              data={SKILL_OPTIONS}
              required
              value={form.skills}
              onChange={(v) => update("skills", v)}
              clearable
              styles={{
                label: { fontWeight: 600 },
                pill: { backgroundColor: "var(--mantine-color-cyan-6)", color: "white" },
              }}
            />
          </Card>

          <Card withBorder radius="md" bg="var(--app-surface)" mb="xl">
            <Text fw={600} c="var(--app-text)" mb="md" component="div">
              <Group gap="xs">
                <Globe size={18} color="#4f46e5" />
                Portfolio Links
              </Group>
            </Text>
            <TagsInput
              label="Portfolio / Social Links"
              placeholder="https://github.com/yourname and press Enter"
              value={form.portfolioLinks}
              onChange={(v) => update("portfolioLinks", v)}
              clearable
              styles={{
                label: { fontWeight: 600 },
                pill: { backgroundColor: "var(--mantine-color-cyan-6)", color: "white" },
              }}
            />
          </Card>

          <Group justify="flex-end">
            <Button
              variant="default"
              component={Link}
              href="/freelancer/profile"
            >
              Cancel
            </Button>
            <Button
              variant="gradient"
              gradient={{ from: "indigo", to: "cyan", deg: 135 }}
              leftSection={<Save size={16} />}
              onClick={handleSave}
              loading={saving}
            >
              Save Changes
            </Button>
          </Group>
        </Box>
      </Box>
    </ProtectedRoute>
  );
}
