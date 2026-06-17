"use client";

import {
  Button,
  Card,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { Plus, Trash2, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { type CvData } from "./CVUploadStep";

const MIN_ROLE_CONFIDENCE = 35;

const fieldLabelStyles = {
  label: { color: "var(--app-text)", fontWeight: 600 },
  required: { color: "var(--app-text)" },
  input: { color: "var(--app-text)" },
};

/**
 * Derive an experience level label from the raw "years of experience" string
 * returned by the CV analyzer (e.g. "36 months", "5 years").
 */
function deriveExperienceLevel(raw: string | undefined): string | null {
  if (!raw) return null;
  const nums = raw.match(/\d+/g);
  if (!nums) return null;

  let months = parseInt(nums[0], 10);
  // If the string says "years", convert to months for uniform comparison
  if (/year/i.test(raw)) months = months * 12;

  if (months < 24) return "Junior";
  if (months < 60) return "Mid-level";
  if (months < 120) return "Senior";
  return "Lead";
}

function formatExperienceItem(item: { role?: string; company?: string; years?: string }) {
  const role = item.role?.trim();
  const company = item.company?.trim();
  const years = item.years?.trim();

  if (role && company && years) return `${role} at ${company} for ${years}`;
  if (role && company) return `${role} at ${company}`;
  if (role && years) return `${role} for ${years}`;
  return role || company || years || "past experience";
}

/**
 * Build a short "About you" bio from extracted CV data.
 */
function buildBio(cvData: CvData): string {
  const parts: string[] = [];

  if (hasConfidentRole(cvData)) {
    parts.push(`Experienced ${cvData.best_role}`);
  }

  const expLevel = deriveExperienceLevel(cvData["years of experience"]);
  if (expLevel && cvData["years of experience"]) {
    parts.push(`with ${cvData["years of experience"]} of hands-on experience`);
  }

  const topSkills = (cvData.all_skills ?? []).slice(0, 5);
  if (topSkills.length > 0) {
    parts.push(`specialising in ${topSkills.join(", ")}`);
  }

  const pastExperience = (cvData.experience ?? [])
    .slice(0, 2)
    .map(formatExperienceItem)
    .filter(Boolean);
  if (pastExperience.length > 0) {
    parts.push(`Past experience includes ${pastExperience.join(" and ")}`);
  }

  if (parts.length === 0) return "";
  return parts.join(" ") + ".";
}

function hasConfidentRole(cvData: CvData) {
  const bestRanking = cvData.role_rankings?.[0];
  const matchedSkillsCount = bestRanking?.matched_skills?.length ?? 0;

  return Boolean(
    cvData.best_role &&
      cvData.role_confidence_status !== "needs_user_input" &&
      (cvData.best_score ?? 0) >= MIN_ROLE_CONFIDENCE &&
      matchedSkillsCount >= 2
  );
}

export interface ProfileData {
  headline: string;
  experienceLevel: string | null;
  country: string;
  skills: string[];
  bio: string;
  experience: { role: string; company: string; years: string }[];
}

interface ProfileStepProps {
  cvData: CvData | null;
  profileData: ProfileData;
  onProfileChange: (data: ProfileData) => void;
}

export function ProfileStep({ cvData, profileData, onProfileChange }: ProfileStepProps) {
  // Local controlled state — mirrors profileData prop
  const [headline, setHeadline] = useState(profileData.headline);
  const [experienceLevel, setExperienceLevel] = useState<string | null>(
    profileData.experienceLevel
  );
  const [country, setCountry] = useState(profileData.country);
  const [skills, setSkills] = useState<string[]>(profileData.skills);
  const [bio, setBio] = useState(profileData.bio);
  const [bioTouched, setBioTouched] = useState(Boolean(profileData.bio));
  const [experience, setExperience] = useState(profileData.experience);

  // Auto-fill whenever cvData arrives (step 0 → step 1 transition)
  useEffect(() => {
    if (!cvData) return;

    const newHeadline = hasConfidentRole(cvData) ? cvData.best_role ?? headline : headline;
    const newLevel = deriveExperienceLevel(cvData["years of experience"]) ?? experienceLevel;
    const newSkills = cvData.all_skills && cvData.all_skills.length > 0
      ? cvData.all_skills
      : skills;
    const newBio = buildBio(cvData);
    const newExperience = cvData.experience?.length
      ? cvData.experience.map((item) => ({
          role: item.role ?? "",
          company: item.company ?? "",
          years: item.years ?? "",
        }))
      : experience;

    setHeadline(newHeadline);
    setExperienceLevel(newLevel);
    setSkills(newSkills);
    setExperience(newExperience);
    if (newBio) setBio(newBio);
    setBioTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cvData]);

  useEffect(() => {
    if (!cvData || bioTouched) return;

    const newBio = buildBio({ ...cvData, experience });
    if (newBio) setBio(newBio);
  }, [bioTouched, cvData, experience]);

  // Propagate changes to parent whenever any field changes
  useEffect(() => {
    onProfileChange({ headline, experienceLevel, country, skills, bio, experience });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headline, experienceLevel, country, skills, bio, experience]);

  const updateExperience = (
    index: number,
    field: "role" | "company" | "years",
    value: string
  ) => {
    setExperience((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const addExperience = () => {
    setExperience((current) => [...current, { role: "", company: "", years: "" }]);
  };

  const removeExperience = (index: number) => {
    setExperience((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <Paper withBorder radius="md" p="lg" bg="var(--app-surface)">
      <Stack gap="lg">
        <Group>
          <ThemeIcon size={46} radius="md" color="indigo" variant="light">
            <UserCircle size={24} />
          </ThemeIcon>
          <Stack gap={0}>
            <Title order={3} c="var(--app-text-strong)">
              Required freelancer information
            </Title>
            <Text c="var(--app-text)" fz="sm">
              {cvData
                ? hasConfidentRole(cvData)
                  ? "Fields have been pre-filled from confident CV evidence — review and adjust as needed."
                  : "The AI could not detect a confident role. Please enter your professional headline manually."
                : "Add key profile details before entering the platform."}
            </Text>
          </Stack>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Professional headline"
            placeholder="Full-stack developer for SaaS apps"
            required
            value={headline}
            onChange={(e) => setHeadline(e.currentTarget.value)}
            styles={fieldLabelStyles}
          />
          <Select
            label="Experience level"
            placeholder="Pick one"
            data={["Junior", "Mid-level", "Senior", "Lead"]}
            required
            value={experienceLevel}
            onChange={setExperienceLevel}
            styles={{
              ...fieldLabelStyles,
              option: { color: "var(--app-text)" },
            }}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1 }} spacing="md">
          <TextInput
            label="Country"
            placeholder="Egypt"
            required
            value={country}
            onChange={(e) => setCountry(e.currentTarget.value)}
            styles={fieldLabelStyles}
          />
        </SimpleGrid>

        <TagsInput
          label="Skills"
          placeholder="Add and press Enter"
          value={skills}
          onChange={setSkills}
          clearable
          required
          styles={{
            ...fieldLabelStyles,
            option: { color: "var(--app-text)" },
            pill: {
              backgroundColor: "var(--mantine-color-cyan-6)",
              color: "white",
            },
          }}
        />

        <Card withBorder radius="md" p="md" bg="var(--app-active-bg)">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start" gap="sm">
              <Stack gap={2}>
                <Text fw={700} fz="sm" c="var(--app-text)">
                  Past experience
                </Text>
                <Text fz="xs" c="dimmed">
                  Review the CV-extracted experience. Edit anything wrong before saving; KBS recommendations will use this corrected evidence.
                </Text>
              </Stack>
              <Button
                size="xs"
                variant="light"
                leftSection={<Plus size={14} />}
                onClick={addExperience}
              >
                Add
              </Button>
            </Group>

            {experience.length === 0 && (
              <Text fz="xs" c="dimmed">
                No past experience was detected. Add it manually if it exists.
              </Text>
            )}

            {experience.map((item, index) => (
              <Card key={index} withBorder radius="md" p="sm" bg="var(--app-surface)">
                <Stack gap="xs">
                  <Group justify="space-between" align="center">
                    <Text fz="xs" fw={700} c="var(--app-text)">
                      Experience {index + 1}
                    </Text>
                    <Button
                      size="compact-xs"
                      color="red"
                      variant="subtle"
                      leftSection={<Trash2 size={12} />}
                      onClick={() => removeExperience(index)}
                    >
                      Remove
                    </Button>
                  </Group>

                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                    <TextInput
                      label="Role"
                      placeholder="Frontend Developer"
                      value={item.role}
                      onChange={(e) => updateExperience(index, "role", e.currentTarget.value)}
                      styles={fieldLabelStyles}
                    />
                    <TextInput
                      label="Company"
                      placeholder="Company name"
                      value={item.company}
                      onChange={(e) => updateExperience(index, "company", e.currentTarget.value)}
                      styles={fieldLabelStyles}
                    />
                    <TextInput
                      label="Duration"
                      placeholder="4 months"
                      value={item.years}
                      onChange={(e) => updateExperience(index, "years", e.currentTarget.value)}
                      styles={fieldLabelStyles}
                    />
                  </SimpleGrid>
                </Stack>
              </Card>
            ))}
          </Stack>
        </Card>

        <Textarea
          label="About you"
          placeholder="Tell clients what you are great at and what outcomes you deliver"
          minRows={4}
          required
          value={bio}
          onChange={(e) => {
            setBioTouched(true);
            setBio(e.currentTarget.value);
          }}
          styles={fieldLabelStyles}
        />
      </Stack>
    </Paper>
  );
}
