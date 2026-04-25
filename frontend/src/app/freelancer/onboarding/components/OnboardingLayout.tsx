"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";

interface StepDef {
  key: string;
  title: string;
  description: string;
}

interface OnboardingLayoutProps {
  steps: readonly StepDef[];
  step: number;
  completion: number;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
  canContinue: boolean;
  children: React.ReactNode;
}

export function OnboardingLayout({
  steps,
  step,
  completion,
  onBack,
  onNext,
  onFinish,
  canContinue,
  children,
}: OnboardingLayoutProps) {
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
          {/* Header */}
          <Group justify="space-between" align="flex-start">
            <Stack gap={6}>
              <Badge size="lg" radius="sm" variant="light" color="cyan">
                Freelancer Setup
              </Badge>
              <Title order={1} c="dark.9">
                Complete your freelancer onboarding
              </Title>
              <Text c="dark.9" maw={720}>
                Upload your CV, complete required information, and finish AI
                interview setup before entering your freelancer workspace.
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

          {/* Progress */}
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
              <Progress
                value={completion}
                color="cyan"
                radius="xl"
                size="md"
              />

              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                {steps.map((item, index) => {
                  const isActive = index === step;
                  const isDone = index < step;

                  return (
                    <Card
                      key={item.key}
                      withBorder
                      radius="md"
                      p="md"
                      bg={isActive ? "cyan.0" : "white"}
                    >
                      <Group justify="space-between" mb={6}>
                        <Text fw={700} c={isActive ? "cyan.8" : "dark.8"}>
                          {index + 1}. {item.title}
                        </Text>
                        {isDone ? (
                          <ThemeIcon
                            color="teal"
                            size={22}
                            radius="xl"
                            variant="filled"
                          >
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

          {/* Step Content */}
          {children}

          {/* Navigation */}
          <Group justify="space-between">
            <Button
              variant="default"
              onClick={onBack}
              disabled={step === 0}
              leftSection={<ArrowLeft size={16} />}
            >
              Previous
            </Button>

            {step < steps.length - 1 ? (
              <Button
                onClick={onNext}
                rightSection={<ArrowRight size={16} />}
                disabled={!canContinue}
              >
                Next step
              </Button>
            ) : (
              <Button
                onClick={onFinish}
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
