"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  FileInput,
  Group,
  List,
  Paper,
  Progress,
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
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  Cpu,
  FileText,
  UserCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type OnboardingStep = 0 | 1 | 2;

const steps = [
  {
    key: "cv",
    title: "Upload CV",
    description: "CV extraction and profile pre-fill",
  },
  {
    key: "profile",
    title: "Complete Profile",
    description: "Add required freelancer details",
  },
  {
    key: "ai",
    title: "AI Interview",
    description: "Readiness and voice interview",
  },
] as const;

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
  label: {
    color: "var(--mantine-color-dark-9)",
    fontWeight: 600,
  },
  required: {
    color: "var(--mantine-color-dark-9)",
  },
  input: {
    color: "var(--mantine-color-dark-9)",
  },
};

export default function FreelancerOnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>(0);
  const [cvExtracted, setCvExtracted] = useState(false);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>(["React", "TypeScript"]);
  const router = useRouter();

  const completion = useMemo(() => Math.round(((step + 1) / steps.length) * 100), [step]);

  const handleCVUpload = (file: File | null) => {
    setCvExtracted(Boolean(file));
    setCvFileName(file ? file.name : null);
  };

  const handleStepBack = () => {
    setStep((current) => Math.max(0, current - 1) as OnboardingStep);
  };

  const handleStepNext = () => {
    setStep((current) => Math.min(2, current + 1) as OnboardingStep);
  };

  const handleFinish = () => {
    router.push("/freelancer/dashboard");
  };

  const canContinue = step !== 0 || cvExtracted;

  return (
    <Box
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 45%), radial-gradient(circle at 85% 15%, rgba(14, 116, 144, 0.12), transparent 35%), #f8fafc",
        padding: "32px 0 64px",
      }}
    >
      <Container size="lg">
        <Stack gap="xl">
          <Group justify="space-between" align="flex-start">
            <Stack gap={6}>
              <Badge size="lg" radius="sm" variant="light" color="cyan">
                Freelancer Setup
              </Badge>
              <Title order={1} c="dark.9">
                Complete your freelancer onboarding
              </Title>
              <Text c="dark.9" maw={720}>
                Upload your CV, complete required information, and finish AI interview setup before entering
                your freelancer workspace.
              </Text>
            </Stack>

            <Button
              component={Link}
              href="/register"
              variant="subtle"
              leftSection={<ArrowLeft size={16} />}
            >
              Back to register
            </Button>
          </Group>

          <Paper withBorder radius="md" p="lg" bg="white">
            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={600} c="dark.9">
                  Progress
                </Text>
                <Text fw={700} c="dark.9">
                  {completion}%
                </Text>
              </Group>
              <Progress value={completion} color="cyan" radius="xl" size="md" />

              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                {steps.map((item, index) => {
                  const isActive = index === step;
                  const isDone = index < step;

                  return (
                    <Card key={item.key} withBorder radius="md" p="md" bg={isActive ? "cyan.0" : "white"}>
                      <Group justify="space-between" mb={6}>
                        <Text fw={700} c={isActive ? "cyan.8" : "dark.8"}>
                          {index + 1}. {item.title}
                        </Text>
                        {isDone ? (
                          <ThemeIcon color="teal" size={22} radius="xl" variant="filled">
                            <Check size={14} />
                          </ThemeIcon>
                        ) : null}
                      </Group>
                      <Text fz="sm" c={isActive ? "cyan.7" : "dimmed"}>
                        {item.description}
                      </Text>
                    </Card>
                  );
                })}
              </SimpleGrid>
            </Stack>
          </Paper>

          {step === 0 ? (
            <Paper withBorder radius="md" p="lg" bg="white">
              <Stack gap="lg">
                <Group>
                  <ThemeIcon size={46} radius="md" color="blue" variant="light">
                    <FileText size={24} />
                  </ThemeIcon>
                  <Stack gap={0}>
                    <Title order={3} c="dark.9">
                      CV extraction
                    </Title>
                    <Text c="dark.9" fz="sm">
                      Upload PDF or DOCX and extract profile details.
                    </Text>
                  </Stack>
                </Group>

                <FileInput
                  label="Upload your CV"
                  placeholder="Select your CV file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleCVUpload}
                  size="md"
                  styles={fieldLabelStyles}
                />

                <Card withBorder radius="md" p="md" bg={cvExtracted ? "cyan.0" : "white"}>
                  <Stack gap={8}>
                    <Group justify="space-between">
                      <Text fw={600} c="dark.9">
                        CV upload status
                      </Text>
                      <Badge color={cvExtracted ? "cyan" : "gray"} variant="light">
                        {cvExtracted ? "Ready" : "Pending"}
                      </Badge>
                    </Group>
                    <Text fz="sm" c="dark.9">
                      {cvExtracted
                        ? `Your CV (${cvFileName}) has been uploaded successfully and will be processed.`
                        : "Upload your CV to continue to the next step."}
                    </Text>
                  </Stack>
                </Card>
              </Stack>
            </Paper>
          ) : null}

          {step === 1 ? (
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
                      option: {
                        color: "var(--mantine-color-dark-9)",
                      },
                    }}
                  />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1 }} spacing="md">
                  <TextInput label="Country" placeholder="Egypt" required styles={fieldLabelStyles} />
                </SimpleGrid>

                <TagsInput
                  label="Skills"
                  placeholder="Add and press Enter"
                  data={skillOptions}
                  value={skills}
                  onChange={setSkills}
                  clearable
                  required
                  styles={{
                    ...fieldLabelStyles,
                    option: {
                      color: "var(--mantine-color-dark-9)",
                    },
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
          ) : null}

          {step === 2 ? (
            <Paper withBorder radius="md" p="lg" bg="white">
              <Stack gap="lg">
                <Group>
                  <ThemeIcon size={46} radius="md" color="cyan" variant="light">
                    <Cpu size={24} />
                  </ThemeIcon>
                  <Stack gap={0}>
                    <Title order={3} c="dark.9">
                      AI interview
                    </Title>
                    <Text c="dark.9" fz="sm">
                      Complete your interview readiness step.
                    </Text>
                  </Stack>
                </Group>

                <Card withBorder radius="md" p="md" bg="cyan.0">
                  <Stack gap={6}>
                    <Text fw={700} c="dark.9">
                      Interview preview
                    </Text>
                    <Text fz="sm" c="dark.9">
                      Duration: 12 minutes | 8 adaptive questions | Soft skills + technical communication
                    </Text>
                    <Text fz="sm" c="dark.9">
                      Status: Ready for your first AI interview session
                    </Text>
                  </Stack>
                </Card>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Card withBorder radius="md" p="md">
                    <Group mb={4}>
                      <Briefcase size={16} />
                      <Text fw={600} c="dark.9">
                        What this validates
                      </Text>
                    </Group>
                    <List spacing={4} fz="sm" c="dark.9">
                      <List.Item>Communication clarity</List.Item>
                      <List.Item>Problem solving approach</List.Item>
                      <List.Item>Client collaboration style</List.Item>
                    </List>
                  </Card>

                  <Card withBorder radius="md" p="md">
                    <Text fw={600} c="dark.9" mb={4}>
                      Score snapshot
                    </Text>
                    <List spacing={4} fz="sm" c="dark.9">
                      <List.Item>Communication: 82/100</List.Item>
                      <List.Item>Technical confidence: 76/100</List.Item>
                      <List.Item>Client fit: 88/100</List.Item>
                    </List>
                  </Card>
                </SimpleGrid>
              </Stack>
            </Paper>
          ) : null}

          <Group justify="space-between">
            <Button
              variant="default"
              onClick={handleStepBack}
              disabled={step === 0}
              leftSection={<ArrowLeft size={16} />}
            >
              Previous
            </Button>

            {step < 2 ? (
              <Button onClick={handleStepNext} rightSection={<ArrowRight size={16} />} disabled={!canContinue}>
                Next step
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                variant="gradient"
                gradient={{ from: "teal", to: "cyan", deg: 110 }}
              >
                Enter freelancer dashboard
              </Button>
            )}
          </Group>
        </Stack>
      </Container>
    </Box>
  );
}
