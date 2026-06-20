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
  FileInput,
  NumberInput,
  Select,
  TagsInput,
  Title,
  Loader,
  Center,
  Alert,
} from "@mantine/core";
import {
  User,
  Save,
  ArrowLeft,
  MapPin,
  DollarSign,
  Globe,
  FileText,
  BrainCircuit,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";
import { cvApi, profileApi, type InterviewReportData } from "@/lib/api";
import { notifications } from "@mantine/notifications";
import Link from "next/link";
import { AIInterviewStep } from "../../onboarding/components/AIInterviewStep";
import type { CvData } from "../../onboarding/components/CVUploadStep";
import type { ProfileData } from "../../onboarding/components/ProfileStep";

const EXPERIENCE_LEVELS = ["Junior", "Mid-level", "Senior", "Lead"];
const AVAILABILITY_OPTIONS = ["Full-time", "Part-time", "As needed", "Not available"];
const CV_ANALYSIS_URL = "/api/cv/analyze";

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

function normalizeCvAnalysis(cvData: CvData) {
  return {
    name: cvData.name,
    email: cvData.email,
    phone: cvData.phone,
    headline: cvData.headline,
    yearsOfExperience: cvData["years of experience"],
    allSkills: cvData.all_skills ?? [],
    domainKnowledge: cvData.domain_knowledge ?? [],
    experience: cvData.experience ?? [],
    education: cvData.education ?? [],
    projects: cvData.projects ?? [],
    certifications: cvData.certifications ?? [],
    publications: cvData.Publications ?? [],
    bestRole: cvData.best_role,
    bestScore: cvData.best_score,
    roleConfidenceStatus: cvData.role_confidence_status,
    roleConfidenceThreshold: cvData.role_confidence_threshold,
    roleRankings: (cvData.role_rankings ?? []).map((ranking) => ({
      role: ranking.role,
      score: ranking.score,
      matchedSkills: ranking.matched_skills ?? [],
      missingSkills: ranking.missing_skills ?? [],
    })),
    analyzedAt: new Date().toISOString(),
  };
}

function cvAnalysisToCvData(value: Record<string, unknown> | null | undefined): CvData | null {
  if (!value) return null;

  return {
    name: typeof value.name === "string" ? value.name : undefined,
    email: typeof value.email === "string" ? value.email : undefined,
    phone: typeof value.phone === "string" ? value.phone : undefined,
    headline: typeof value.headline === "string" ? value.headline : undefined,
    "years of experience": typeof value.yearsOfExperience === "string" ? value.yearsOfExperience : undefined,
    all_skills: Array.isArray(value.allSkills) ? value.allSkills.filter((item): item is string => typeof item === "string") : [],
    domain_knowledge: Array.isArray(value.domainKnowledge) ? value.domainKnowledge.filter((item): item is string => typeof item === "string") : [],
    experience: Array.isArray(value.experience) ? (value.experience as CvData["experience"]) : [],
    education: Array.isArray(value.education) ? (value.education as CvData["education"]) : [],
    projects: Array.isArray(value.projects) ? (value.projects as CvData["projects"]) : [],
    certifications: Array.isArray(value.certifications) ? (value.certifications as CvData["certifications"]) : [],
    best_role: typeof value.bestRole === "string" ? value.bestRole : undefined,
    best_score: typeof value.bestScore === "number" ? value.bestScore : undefined,
  };
}

export default function EditProfilePage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cvUpdating, setCvUpdating] = useState(false);
  const [retakeOpen, setRetakeOpen] = useState(false);
  const [cvData, setCvData] = useState<CvData | null>(null);
  const [interviewReport, setInterviewReport] = useState<InterviewReportData | null>(null);

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
    const fp = user.freelancerProfile || {};
    queueMicrotask(() => {
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
      setCvData(cvAnalysisToCvData(fp.cvAnalysis));
      setInterviewReport((fp.aiInterviewReport as InterviewReportData | null | undefined) ?? null);
      setLoading(false);
    });
  }, [user]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const getMissingFields = () => {
    const missing: string[] = [];
    if (!form.name.trim()) missing.push("full name");
    if (!form.headline.trim()) missing.push("headline");
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

  const handleCvReupload = async (file: File | null) => {
    if (!file) return;

    setCvUpdating(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(CV_ANALYSIS_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || data?.detail || "CV analysis failed");
      }

      const extracted: CvData = await response.json();
      const nextSkills = extracted.all_skills?.length ? extracted.all_skills : form.skills;
      const nextHeadline = extracted.headline || form.headline;
      const cvAnalysis = normalizeCvAnalysis(extracted);

      await cvApi.upload(file);
      await profileApi.update({
        profile: {
          headline: nextHeadline,
          skills: nextSkills,
          cvAnalysis,
        },
      });

      update("headline", nextHeadline);
      update("skills", nextSkills);
      setCvData(extracted);
      await refreshUser();

      notifications.show({
        title: "CV updated",
        message: "Your CV contents and profile skills were refreshed.",
        color: "green",
      });
    } catch (error: unknown) {
      notifications.show({
        title: "CV update failed",
        message: error instanceof Error ? error.message : "Please try again.",
        color: "red",
      });
    } finally {
      setCvUpdating(false);
    }
  };

  const profileDataForInterview: ProfileData = {
    headline: form.headline,
    experienceLevel: form.experienceLevel || null,
    country: form.country,
    hourlyRate: form.hourlyRate,
    availability: form.availability || null,
    skills: form.skills,
    portfolioLinks: form.portfolioLinks,
    bio: form.about,
    experience: cvData?.experience ?? [],
  };

  const handleRetakeComplete = async (report: InterviewReportData) => {
    setInterviewReport(report);
    await profileApi.update({
      profile: { aiInterviewReport: report },
    });
    await refreshUser();
    notifications.show({
      title: "AI interview updated",
      message: "Your latest interview report was saved to your profile.",
      color: "green",
    });
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

          <Card withBorder radius="md" bg="var(--app-surface)" mb="md">
            <Group justify="space-between" align="flex-start" mb="md">
              <Group gap="xs">
                <FileText size={18} color="#4f46e5" />
                <Text fw={600} c="var(--app-text)">CV Contents</Text>
              </Group>
              {user?.freelancerProfile?.cvFileName && (
                <Text fz="xs" c="dimmed">
                  Current: {user.freelancerProfile.cvFileName}
                </Text>
              )}
            </Group>
            <Stack gap="sm">
              <Text fz="sm" c="var(--app-text)">
                Reupload your CV to refresh extracted skills, headline, projects, and experience evidence.
              </Text>
              <FileInput
                label="Reupload CV"
                placeholder="Select a PDF CV"
                accept=".pdf,application/pdf"
                onChange={handleCvReupload}
                disabled={cvUpdating}
                styles={{ label: { fontWeight: 600 } }}
              />
              {cvData?.all_skills && cvData.all_skills.length > 0 && (
                <Alert color="cyan" radius="md">
                  Latest extracted skills: {cvData.all_skills.slice(0, 8).join(", ")}
                </Alert>
              )}
            </Stack>
          </Card>

          <Card withBorder radius="md" bg="var(--app-surface)" mb="md">
            <Group justify="space-between" align="flex-start" mb="md">
              <Group gap="xs">
                <BrainCircuit size={18} color="#0891b2" />
                <Text fw={600} c="var(--app-text)">AI Interview</Text>
              </Group>
              {interviewReport && (
                <Text fz="xs" c="dimmed">
                  Latest score: {interviewReport.overall_score}%
                </Text>
              )}
            </Group>
            <Stack gap="sm">
              <Text fz="sm" c="var(--app-text)">
                Retake the AI interview to update your verification score using your current profile skills.
              </Text>
              <Button
                variant="light"
                color="cyan"
                leftSection={<BrainCircuit size={16} />}
                onClick={() => setRetakeOpen((current) => !current)}
              >
                {retakeOpen ? "Hide AI test" : "Retake AI test"}
              </Button>
              {form.skills.length === 0 && (
                <Alert color="orange" radius="md">
                  Add at least one skill before retaking the AI interview.
                </Alert>
              )}
              {retakeOpen && (
                <AIInterviewStep
                  cvData={cvData}
                  profileData={profileDataForInterview}
                  report={null}
                  onComplete={handleRetakeComplete}
                />
              )}
            </Stack>
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
