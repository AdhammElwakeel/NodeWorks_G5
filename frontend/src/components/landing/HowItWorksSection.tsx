"use client";

import { Container, Title, Text, Box, Stack, Card, Group, Grid, ThemeIcon } from "@mantine/core";
import { UserCheck, FileText, Award, Briefcase, Building2, Send, Users, Handshake, LucideIcon } from "lucide-react";

interface Step {
  icon: LucideIcon;
  title: string;
  description: string;
}

const freelancerSteps: Step[] = [
  {
    icon: UserCheck,
    title: "Sign Up & Verify",
    description: "Complete OTP verification to secure your account",
  },
  {
    icon: FileText,
    title: "Upload CV",
    description: "Our AI extracts and analyzes your skills and experience",
  },
  {
    icon: Award,
    title: "AI Interview",
    description: "Complete a quick AI-proctored interview to earn your badge",
  },
  {
    icon: Briefcase,
    title: "Start Earning",
    description: "Receive job invitations or browse opportunities",
  },
];

const clientSteps: Step[] = [
  {
    icon: Building2,
    title: "Create Account",
    description: "Quick sign-up process to get started",
  },
  {
    icon: Send,
    title: "Post a Job",
    description: "Describe your project requirements and desired skills",
  },
  {
    icon: Users,
    title: "Review Matches",
    description: "AI suggests the best-fit freelancers with synergy scores",
  },
  {
    icon: Handshake,
    title: "Hire & Collaborate",
    description: "Choose your team and start working immediately",
  },
];

interface ProcessCardProps {
  title: string;
  steps: Step[];
  gradient: { from: string; to: string };
}

function ProcessCard({ title, steps, gradient }: ProcessCardProps) {
  return (
    <Card
      shadow="sm"
      padding="xl"
      radius="lg"
      h="100%"
      style={{
        border: "1px solid var(--mantine-color-gray-2)",
      }}
    >
      <Stack gap="xl">
        <Title order={3} ta="center" c="var(--app-text)">
          {title}
        </Title>

        <Stack gap="lg">
          {steps.map((step, index) => {
            const IconComponent = step.icon;
            return (
              <Group key={step.title} gap="md" align="flex-start" wrap="nowrap">
                <Box style={{ position: "relative" }}>
                  <ThemeIcon
                    size={44}
                    radius="md"
                    variant="gradient"
                    gradient={gradient}
                  >
                    <IconComponent size={22} />
                  </ThemeIcon>
                  {index < steps.length - 1 && (
                    <Box
                      style={{
                        position: "absolute",
                        left: "50%",
                        top: 44,
                        width: 2,
                        height: 24,
                        backgroundColor: "var(--mantine-color-gray-3)",
                        transform: "translateX(-50%)",
                      }}
                    />
                  )}
                </Box>
                <Stack gap={4} style={{ flex: 1 }} pt={4}>
                  <Text fw={600} c="var(--app-text)">
                    {step.title}
                  </Text>
                  <Text fz="sm" c="dimmed">
                    {step.description}
                  </Text>
                </Stack>
              </Group>
            );
          })}
        </Stack>
      </Stack>
    </Card>
  );
}

export function HowItWorksSection() {
  return (
    <Box component="section" py={{ base: 60, md: 80, lg: 100 }} bg="var(--app-bg)">
      <Container size="xl">
        <Stack gap="xl">
          {/* Section Header */}
          <Stack gap="sm" align="center" ta="center" mb="xl">
            <Title order={2} fz={{ base: 28, md: 36 }} fw={700} c="var(--app-text-strong)">
              How It Works
            </Title>
            <Text fz="lg" c="dimmed" maw={500}>
              Get started in minutes with our streamlined process
            </Text>
          </Stack>

          {/* Process Cards */}
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <ProcessCard
                title="For Freelancers"
                steps={freelancerSteps}
                gradient={{ from: "indigo", to: "blue" }}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <ProcessCard
                title="For Clients"
                steps={clientSteps}
                gradient={{ from: "blue", to: "cyan" }}
              />
            </Grid.Col>
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}
