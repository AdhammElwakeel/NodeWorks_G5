"use client";

import {
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
import { UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { type CvData } from "./CVUploadStep";

const fieldLabelStyles = {
  label: { color: "var(--mantine-color-dark-9)", fontWeight: 600 },
  required: { color: "var(--mantine-color-dark-9)" },
  input: { color: "var(--mantine-color-dark-9)" },
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

/**
 * Build a short "About you" bio from extracted CV data.
 */
function buildBio(cvData: CvData): string {
  const parts: string[] = [];

  if (cvData.best_role) {
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

  if (parts.length === 0) return "";
  return parts.join(" ") + ".";
}

export interface ProfileData {
  headline: string;
  experienceLevel: string | null;
  country: string;
  skills: string[];
  bio: string;
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

  // Auto-fill whenever cvData arrives (step 0 → step 1 transition)
  useEffect(() => {
    if (!cvData) return;

    const newHeadline = cvData.best_role ?? headline;
    const newLevel = deriveExperienceLevel(cvData["years of experience"]) ?? experienceLevel;
    const newSkills = cvData.all_skills && cvData.all_skills.length > 0
      ? cvData.all_skills
      : skills;
    const newBio = buildBio(cvData);

    setHeadline(newHeadline);
    setExperienceLevel(newLevel);
    setSkills(newSkills);
    if (newBio) setBio(newBio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cvData]);

  // Propagate changes to parent whenever any field changes
  useEffect(() => {
    onProfileChange({ headline, experienceLevel, country, skills, bio });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headline, experienceLevel, country, skills, bio]);

  return (
    <Paper withBorder radius="md" p="lg" bg="white">
      <Stack gap="lg">
        <Group>
          <ThemeIcon size={46} radius="md" color="indigo" variant="light">
            <UserCircle size={24} />
          </ThemeIcon>
          <Stack gap={0}>
            <Title order={3} c="dark.9">
              Required freelancer information
            </Title>
            <Text c="dark.9" fz="sm">
              {cvData
                ? "Fields have been pre-filled from your CV — review and adjust as needed."
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
              option: { color: "var(--mantine-color-dark-9)" },
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
            option: { color: "var(--mantine-color-dark-9)" },
            pill: {
              backgroundColor: "var(--mantine-color-dark-9)",
              color: "white",
            },
          }}
        />

        <Textarea
          label="About you"
          placeholder="Tell clients what you are great at and what outcomes you deliver"
          minRows={4}
          required
          value={bio}
          onChange={(e) => setBio(e.currentTarget.value)}
          styles={fieldLabelStyles}
        />
      </Stack>
    </Paper>
  );
}
