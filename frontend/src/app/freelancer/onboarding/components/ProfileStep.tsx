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
}

export function ProfileStep({ skills, onSkillsChange }: ProfileStepProps) {
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
            styles={fieldLabelStyles}
          />
          <Select
            label="Experience level"
            placeholder="Pick one"
            data={["Junior", "Mid-level", "Senior", "Lead"]}
            required
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
          styles={fieldLabelStyles}
        />
      </Stack>
    </Paper>
  );
}
