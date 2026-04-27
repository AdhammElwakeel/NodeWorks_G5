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

const skillOptions = [
  "React",
  "Next.js",
  "Node.js",
  "TypeScript",
  "UI Design",
  "Project Management",
  "Python",
  "Data Analysis",
  "Content Writing",
];

const fieldLabelStyles = {
  label: { color: "var(--mantine-color-dark-9)", fontWeight: 600 },
  required: { color: "var(--mantine-color-dark-9)" },
  input: { color: "var(--mantine-color-dark-9)" },
};

interface ProfileStepProps {
  skills: string[];
  onSkillsChange: (skills: string[]) => void;
  headline: string;
  onHeadlineChange: (val: string) => void;
  experienceLevel: string | null;
  onExperienceLevelChange: (val: string | null) => void;
  country: string;
  onCountryChange: (val: string) => void;
  about: string;
  onAboutChange: (val: string) => void;
}

export function ProfileStep({
  skills,
  onSkillsChange,
  headline,
  onHeadlineChange,
  experienceLevel,
  onExperienceLevelChange,
  country,
  onCountryChange,
  about,
  onAboutChange,
}: ProfileStepProps) {
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
              Add key profile details before entering the platform.
            </Text>
          </Stack>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Professional headline"
            placeholder="Full-stack developer for SaaS apps"
            required
            value={headline}
            onChange={(e) => onHeadlineChange(e.target.value)}
            styles={fieldLabelStyles}
          />
          <Select
            label="Experience level"
            placeholder="Pick one"
            data={["Junior", "Mid-level", "Senior", "Lead"]}
            required
            value={experienceLevel}
            onChange={onExperienceLevelChange}
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
            onChange={(e) => onCountryChange(e.target.value)}
            styles={fieldLabelStyles}
          />
        </SimpleGrid>

        <TagsInput
          label="Skills"
          placeholder="Add and press Enter"
          data={skillOptions}
          value={skills}
          onChange={onSkillsChange}
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
          value={about}
          onChange={(e) => onAboutChange(e.target.value)}
          styles={fieldLabelStyles}
        />
      </Stack>
    </Paper>
  );
}