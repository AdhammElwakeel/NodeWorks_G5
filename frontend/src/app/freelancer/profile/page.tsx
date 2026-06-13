"use client";

import { useState, useEffect } from "react";
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
  FileInput,
  Badge,
  Alert,
  SimpleGrid,
} from "@mantine/core";
import {
  User,
  Save,
  ArrowLeft,
  MapPin,
  DollarSign,
  Globe,
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  Briefcase,
  GraduationCap,
  FolderOpen,
  Award,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  HeaderBanner,
  HomeSection,
  Sidebar,
} from "@/components/freelancer/dashboard";
import { useAuth } from "@/lib/auth-context";
import { profileApi } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import Link from "next/link";

const EXPERIENCE_LEVELS = ["Junior", "Mid-level", "Senior", "Lead"];
const AVAILABILITY_OPTIONS = [
  "Full-time",
  "Part-time",
  "As needed",
  "Not available",
];

const CV_ANALYSIS_URL =
  process.env.NEXT_PUBLIC_CV_ANALYSIS_API_URL ??
  "http://localhost:8000/api/analyze-cv";

// Derive experience level from a raw "N months" or "N years" string
function deriveExperienceLevel(raw: string | undefined): string | null {
  if (!raw) return null;
  const nums = raw.match(/\d+/g);
  if (!nums) return null;
  let months = parseInt(nums[0], 10);
  if (/year/i.test(raw)) months = months * 12;
  if (months < 24) return "Junior";
  if (months < 60) return "Mid-level";
  if (months < 120) return "Senior";
  return "Lead";
}

export default function FreelancerProfilePage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // CV re-upload state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisSuccess, setAnalysisSuccess] = useState(false);

  const [form, setForm] = useState({
    // Basic
    name: "",
    headline: "",
    about: "",
    country: "",
    phone: "",
    hourlyRate: 0,
    experienceLevel: "",
    availability: "",
    yearsOfExperience: "",
    // Skills & links
    skills: [] as string[],
    portfolioLinks: [] as string[],
    // From CV
    experience: [] as { role: string; company: string; years: string }[],
    education: [] as { degree: string; institution: string }[],
    projects: [] as { name: string; technologies: string[] }[],
    certifications: [] as { name: string }[],
    bestRole: "",
    bestScore: 0,
  });

  useEffect(() => {
    if (!user) return;
    const fp =
      (user as { freelancerProfile?: Record<string, unknown> })
        .freelancerProfile ?? {};
    setForm({
      name: user.name || "",
      headline: (fp.headline as string | undefined) ?? user.name ?? "",
      about: (fp.about as string | undefined) ?? "",
      country: (fp.country as string | undefined) ?? "",
      phone: (fp.phone as string | undefined) ?? "",
      hourlyRate: (fp.hourlyRate as number | undefined) ?? 0,
      experienceLevel: (fp.experienceLevel as string | undefined) ?? "",
      availability: (fp.availability as string | undefined) ?? "",
      yearsOfExperience: (fp.yearsOfExperience as string | undefined) ?? "",
      skills: (fp.skills as string[] | undefined) ?? [],
      portfolioLinks: (fp.portfolioLinks as string[] | undefined) ?? [],
      experience:
        (fp.experience as
          | { role: string; company: string; years: string }[]
          | undefined) ?? [],
      education:
        (fp.education as
          | { degree: string; institution: string }[]
          | undefined) ?? [],
      projects:
        (fp.projects as
          | { name: string; technologies: string[] }[]
          | undefined) ?? [],
      certifications:
        (fp.certifications as { name: string }[] | undefined) ?? [],
      bestRole: (fp.bestRole as string | undefined) ?? "",
      bestScore: (fp.bestScore as number | undefined) ?? 0,
    });
    setLoading(false);
  }, [user]);

  const update = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Re-upload CV and auto-fill fields
  const handleCVReUpload = async (file: File | null) => {
    setAnalysisError(null);
    setAnalysisSuccess(false);
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(CV_ANALYSIS_URL, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err?.detail ?? "CV analysis failed");
      }
      const data = await res.json();

      // Auto-fill all fields from CV data
      setForm((prev) => ({
        ...prev,
        name: data.name || prev.name,
        phone: data.phone || prev.phone,
        headline: data.best_role || prev.headline,
        experienceLevel:
          deriveExperienceLevel(data["years of experience"]) ||
          prev.experienceLevel,
        yearsOfExperience:
          data["years of experience"] || prev.yearsOfExperience,
        skills: data.all_skills?.length ? data.all_skills : prev.skills,
        experience: data.experience?.length ? data.experience : prev.experience,
        education: data.education?.length
          ? data.education.map(
              (e: { degree: string; institution: string }) => ({
                degree: e.degree,
                institution: e.institution,
              }),
            )
          : prev.education,
        projects: data.projects?.length ? data.projects : prev.projects,
        certifications: data.certifications?.length
          ? data.certifications.map((c: { name: string }) => ({ name: c.name }))
          : prev.certifications,
        bestRole: data.best_role || prev.bestRole,
        bestScore: data.best_score ?? prev.bestScore,
        about:
          prev.about ||
          (data.best_role
            ? `Experienced ${data.best_role}${data["years of experience"] ? ` with ${data["years of experience"]} of experience` : ""}${data.all_skills?.length ? `, specialising in ${data.all_skills.slice(0, 5).join(", ")}` : ""}.`
            : ""),
      }));
      setAnalysisSuccess(true);
      notifications.show({
        title: "CV Analysis Complete",
        message: "Your profile has been updated with data from your CV.",
        color: "teal",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setAnalysisError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await profileApi.update({
        name: form.name,
        profile: {
          headline: form.headline,
          about: form.about,
          country: form.country,
          phone: form.phone,
          hourlyRate: form.hourlyRate,
          experienceLevel: form.experienceLevel,
          availability: form.availability,
          yearsOfExperience: form.yearsOfExperience,
          skills: form.skills,
          portfolioLinks: form.portfolioLinks,
          experience: form.experience,
          education: form.education,
          projects: form.projects,
          certifications: form.certifications,
          bestRole: form.bestRole,
          bestScore: form.bestScore,
        },
      });
      await refreshUser();
      notifications.show({
        title: "Profile saved",
        message: "Your profile has been updated successfully.",
        color: "green",
      });
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
        <Center style={{ minHeight: "100vh" }}>
          <Loader color="cyan" />
        </Center>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="freelancer">
      <Box
        style={{
          minHeight: "100vh",
          backgroundColor: "#f8fafc",
          padding: "32px 24px",
        }}
      >
        <Box maw={800} mx="auto">
          {/* Back Button */}
          <Group mb="lg">
            <Button
              component={Link}
              href="/freelancer/dashboard"
              variant="subtle"
              leftSection={<ArrowLeft size={16} />}
              size="sm"
            >
              Back to dashboard
            </Button>
          </Group>

          {/* Page Header */}
          <Group mb="xl" justify="space-between" align="center">
            <Group gap="sm">
              <User size={28} color="#4f46e5" />
              <Stack gap={0}>
                <Title order={2} c="dark.9">
                  Edit Profile
                </Title>
                <Text fz="sm" c="dimmed">
                  Update your freelancer information
                </Text>
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

          {/* ── CV Re-Upload Section ────────────────────────────── */}
          <Card withBorder radius="md" bg="white" mb="md">
            <Group mb="sm">
              <Upload size={18} color="#4f46e5" />
              <Text fw={600} c="dark.9">
                Re-upload CV
              </Text>
            </Group>
            <Text fz="sm" c="dimmed" mb="md">
              Upload a new CV to automatically update your profile fields with
              the latest data.
            </Text>

            <FileInput
              label="Select CV (PDF only)"
              placeholder="Click to choose a PDF file"
              accept=".pdf"
              onChange={handleCVReUpload}
              leftSection={<FileText size={16} />}
              disabled={isAnalyzing}
              styles={{ label: { fontWeight: 600 } }}
            />

            {isAnalyzing && (
              <Alert
                icon={<Loader size="xs" />}
                color="blue"
                mt="sm"
                radius="md"
              >
                Analyzing your CV with AI…
              </Alert>
            )}
            {analysisSuccess && !isAnalyzing && (
              <Alert
                icon={<CheckCircle size={16} />}
                color="teal"
                mt="sm"
                radius="md"
              >
                CV analyzed successfully! Fields have been updated below.
                {form.bestRole && (
                  <Badge color="indigo" variant="light" ml="xs">
                    Best Match: {form.bestRole} ({form.bestScore}%)
                  </Badge>
                )}
              </Alert>
            )}
            {analysisError && !isAnalyzing && (
              <Alert
                icon={<AlertCircle size={16} />}
                color="red"
                mt="sm"
                radius="md"
              >
                {analysisError}
              </Alert>
            )}
          </Card>

          {/* ── Basic Info ──────────────────────────────────────── */}
          <Card withBorder radius="md" bg="white" mb="md">
            <Text fw={600} c="dark.9" mb="md">
              Basic Information
            </Text>
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label="Full Name"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  styles={{ label: { fontWeight: 600 } }}
                />
                <TextInput
                  label="Phone"
                  placeholder="+20 100 000 0000"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  styles={{ label: { fontWeight: 600 } }}
                />
              </SimpleGrid>
              <TextInput
                label="Professional Headline"
                placeholder="e.g. Full-Stack Developer specializing in SaaS"
                value={form.headline}
                onChange={(e) => update("headline", e.target.value)}
                styles={{ label: { fontWeight: 600 } }}
              />
              <Textarea
                label="About You"
                placeholder="Tell clients about your expertise, experience, and what makes you great at what you do..."
                minRows={5}
                value={form.about}
                onChange={(e) => update("about", e.target.value)}
                styles={{ label: { fontWeight: 600 } }}
              />
            </Stack>
          </Card>

          {/* ── Location & Rate ─────────────────────────────────── */}
          <Card withBorder radius="md" bg="white" mb="md">
            <Text fw={600} c="dark.9" mb="md">
              Location &amp; Rate
            </Text>
            <Group grow>
              <TextInput
                label="Country"
                placeholder="e.g. Egypt"
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                leftSection={<MapPin size={16} color="#94a3b8" />}
                styles={{ label: { fontWeight: 600 } }}
              />
              <NumberInput
                label="Hourly Rate (USD)"
                placeholder="e.g. 50"
                value={form.hourlyRate}
                onChange={(v) => update("hourlyRate", (v as number) || 0)}
                min={0}
                leftSection={<DollarSign size={16} color="#94a3b8" />}
                styles={{ label: { fontWeight: 600 } }}
              />
            </Group>
          </Card>

          {/* ── Experience & Availability ───────────────────────── */}
          <Card withBorder radius="md" bg="white" mb="md">
            <Text fw={600} c="dark.9" mb="md">
              Experience &amp; Availability
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <Select
                label="Experience Level"
                placeholder="Select level"
                data={EXPERIENCE_LEVELS}
                value={form.experienceLevel}
                onChange={(v) => update("experienceLevel", v || "")}
                styles={{ label: { fontWeight: 600 } }}
              />
              <TextInput
                label="Years of Experience"
                placeholder="e.g. 36 months"
                value={form.yearsOfExperience}
                onChange={(e) => update("yearsOfExperience", e.target.value)}
                styles={{ label: { fontWeight: 600 } }}
              />
              <Select
                label="Availability"
                placeholder="Select availability"
                data={AVAILABILITY_OPTIONS}
                value={form.availability}
                onChange={(v) => update("availability", v || "")}
                styles={{ label: { fontWeight: 600 } }}
              />
            </SimpleGrid>
          </Card>

          {/* ── Skills ─────────────────────────────────────────── */}
          <Card withBorder radius="md" bg="white" mb="md">
            <Text fw={600} c="dark.9" mb="md">
              Skills
            </Text>
            <TagsInput
              label="Your Skills"
              placeholder="Type a skill and press Enter"
              value={form.skills}
              onChange={(v) => update("skills", v)}
              clearable
              styles={{
                label: { fontWeight: 600 },
                pill: { backgroundColor: "#1e293b", color: "white" },
              }}
            />
          </Card>

          {/* ── Work Experience ─────────────────────────────────── */}
          <Card withBorder radius="md" bg="white" mb="md">
            <Group mb="md" gap="xs">
              <Briefcase size={18} color="#4f46e5" />
              <Text fw={600} c="dark.9">
                Work Experience
              </Text>
            </Group>
            {form.experience.length === 0 && (
              <Text fz="sm" c="dimmed">
                No experience added yet. Upload your CV to auto-fill.
              </Text>
            )}
            <Stack gap="xs">
              {form.experience.map((exp, i) => (
                <Box
                  key={i}
                  p="sm"
                  style={{
                    border: "1px solid var(--mantine-color-gray-3)",
                    borderRadius: 8,
                  }}
                >
                  <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <TextInput
                      label="Role"
                      value={exp.role}
                      onChange={(e) => {
                        const updated = [...form.experience];
                        updated[i] = { ...updated[i], role: e.target.value };
                        update("experience", updated);
                      }}
                      styles={{ label: { fontWeight: 500, fontSize: 12 } }}
                    />
                    <TextInput
                      label="Company"
                      value={exp.company}
                      onChange={(e) => {
                        const updated = [...form.experience];
                        updated[i] = { ...updated[i], company: e.target.value };
                        update("experience", updated);
                      }}
                      styles={{ label: { fontWeight: 500, fontSize: 12 } }}
                    />
                    <TextInput
                      label="Duration"
                      value={exp.years}
                      onChange={(e) => {
                        const updated = [...form.experience];
                        updated[i] = { ...updated[i], years: e.target.value };
                        update("experience", updated);
                      }}
                      styles={{ label: { fontWeight: 500, fontSize: 12 } }}
                    />
                  </SimpleGrid>
                </Box>
              ))}
              <Button
                variant="light"
                size="xs"
                onClick={() =>
                  update("experience", [
                    ...form.experience,
                    { role: "", company: "", years: "" },
                  ])
                }
              >
                + Add Experience
              </Button>
            </Stack>
          </Card>

          {/* ── Education ───────────────────────────────────────── */}
          <Card withBorder radius="md" bg="white" mb="md">
            <Group mb="md" gap="xs">
              <GraduationCap size={18} color="#4f46e5" />
              <Text fw={600} c="dark.9">
                Education
              </Text>
            </Group>
            {form.education.length === 0 && (
              <Text fz="sm" c="dimmed">
                No education added yet. Upload your CV to auto-fill.
              </Text>
            )}
            <Stack gap="xs">
              {form.education.map((edu, i) => (
                <Box
                  key={i}
                  p="sm"
                  style={{
                    border: "1px solid var(--mantine-color-gray-3)",
                    borderRadius: 8,
                  }}
                >
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label="Degree"
                      value={edu.degree}
                      onChange={(e) => {
                        const updated = [...form.education];
                        updated[i] = { ...updated[i], degree: e.target.value };
                        update("education", updated);
                      }}
                      styles={{ label: { fontWeight: 500, fontSize: 12 } }}
                    />
                    <TextInput
                      label="Institution"
                      value={edu.institution}
                      onChange={(e) => {
                        const updated = [...form.education];
                        updated[i] = {
                          ...updated[i],
                          institution: e.target.value,
                        };
                        update("education", updated);
                      }}
                      styles={{ label: { fontWeight: 500, fontSize: 12 } }}
                    />
                  </SimpleGrid>
                </Box>
              ))}
              <Button
                variant="light"
                size="xs"
                onClick={() =>
                  update("education", [
                    ...form.education,
                    { degree: "", institution: "" },
                  ])
                }
              >
                + Add Education
              </Button>
            </Stack>
          </Card>

          {/* ── Projects ────────────────────────────────────────── */}
          <Card withBorder radius="md" bg="white" mb="md">
            <Group mb="md" gap="xs">
              <FolderOpen size={18} color="#4f46e5" />
              <Text fw={600} c="dark.9">
                Projects
              </Text>
            </Group>
            {form.projects.length === 0 && (
              <Text fz="sm" c="dimmed">
                No projects added yet. Upload your CV to auto-fill.
              </Text>
            )}
            <Stack gap="xs">
              {form.projects.map((proj, i) => (
                <Box
                  key={i}
                  p="sm"
                  style={{
                    border: "1px solid var(--mantine-color-gray-3)",
                    borderRadius: 8,
                  }}
                >
                  <Stack gap="xs">
                    <TextInput
                      label="Project Name"
                      value={proj.name}
                      onChange={(e) => {
                        const updated = [...form.projects];
                        updated[i] = { ...updated[i], name: e.target.value };
                        update("projects", updated);
                      }}
                      styles={{ label: { fontWeight: 500, fontSize: 12 } }}
                    />
                    <TagsInput
                      label="Technologies"
                      value={proj.technologies || []}
                      onChange={(v) => {
                        const updated = [...form.projects];
                        updated[i] = { ...updated[i], technologies: v };
                        update("projects", updated);
                      }}
                      styles={{
                        label: { fontWeight: 500, fontSize: 12 },
                        pill: { backgroundColor: "#1e293b", color: "white" },
                      }}
                    />
                  </Stack>
                </Box>
              ))}
              <Button
                variant="light"
                size="xs"
                onClick={() =>
                  update("projects", [
                    ...form.projects,
                    { name: "", technologies: [] },
                  ])
                }
              >
                + Add Project
              </Button>
            </Stack>
          </Card>

          {/* ── Certifications ──────────────────────────────────── */}
          <Card withBorder radius="md" bg="white" mb="md">
            <Group mb="md" gap="xs">
              <Award size={18} color="#4f46e5" />
              <Text fw={600} c="dark.9">
                Certifications
              </Text>
            </Group>
            {form.certifications.length === 0 && (
              <Text fz="sm" c="dimmed">
                No certifications added yet. Upload your CV to auto-fill.
              </Text>
            )}
            <Stack gap="xs">
              {form.certifications.map((cert, i) => (
                <TextInput
                  key={i}
                  label={`Certification ${i + 1}`}
                  value={cert.name}
                  onChange={(e) => {
                    const updated = [...form.certifications];
                    updated[i] = { name: e.target.value };
                    update("certifications", updated);
                  }}
                  styles={{ label: { fontWeight: 500, fontSize: 12 } }}
                />
              ))}
              <Button
                variant="light"
                size="xs"
                onClick={() =>
                  update("certifications", [
                    ...form.certifications,
                    { name: "" },
                  ])
                }
              >
                + Add Certification
              </Button>
            </Stack>
          </Card>

          {/* ── Portfolio Links ─────────────────────────────────── */}
          <Card withBorder radius="md" bg="white" mb="xl">
            <Group mb="md" gap="xs">
              <Globe size={18} color="#4f46e5" />
              <Text fw={600} c="dark.9">
                Portfolio Links
              </Text>
            </Group>
            <TagsInput
              label="Portfolio / Social Links"
              placeholder="https://github.com/yourname and press Enter"
              value={form.portfolioLinks}
              onChange={(v) => update("portfolioLinks", v)}
              clearable
              styles={{
                label: { fontWeight: 600 },
                pill: { backgroundColor: "#1e293b", color: "white" },
              }}
            />
          </Card>

          {/* Bottom Save */}
          <Group justify="flex-end">
            <Button
              variant="default"
              component={Link}
              href="/freelancer/dashboard"
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
