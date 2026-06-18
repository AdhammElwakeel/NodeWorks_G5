"use client";

import { useState } from "react";
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
  Select,
  Title,
  Stepper,
  Avatar,
  Progress,
} from "@mantine/core";
import {
  Building2,
  Globe,
  Users,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Briefcase,
  Sparkles,
} from "lucide-react";
import { notifications } from "@mantine/notifications";
import { profileApi } from "@/lib/api";

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "E-commerce",
  "Education",
  "Marketing",
  "Real Estate",
  "Manufacturing",
  "Consulting",
  "Other",
];

const COMPANY_SIZES = [
  "1-10 employees",
  "11-50 employees",
  "51-200 employees",
  "201-500 employees",
  "500+ employees",
];

export default function ClientOnboardingPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState<string | null>(null);
  const [companySize, setCompanySize] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");

  const canProceedStep0 = companyName.trim() && industry && companySize;
  const canProceedStep1 = description.trim().length >= 20;

  const handleFinish = async () => {
    setLoading(true);
    try {
      await profileApi.update({
        profile: {
          companyName: companyName.trim(),
          industry,
          companySize,
          description: description.trim(),
          website: website.trim() || undefined,
        },
      });
      notifications.show({
        title: "Profile complete!",
        message: "Welcome to NodeWorks Client. Let's find you some talent.",
        color: "green",
        icon: <CheckCircle2 size={16} />,
      });
      router.push("/client/dashboard");
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to save your profile. Please try again.",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (activeStep === 2) {
      handleFinish();
      return;
    }
    setActiveStep((s) => s + 1);
  };

  const handleBack = () => setActiveStep((s) => s - 1);

  const steps = [
    { label: "Company Info", description: "Basic details" },
    { label: "About", description: "Tell us more" },
    { label: "Ready", description: "You're all set" },
  ];

  return (
    <Box
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, var(--app-bg) 0%, rgba(79, 70, 229, 0.14) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <Card
        withBorder
        shadow="md"
        radius="lg"
        style={{
          width: "100%",
          maxWidth: 640,
          background: "var(--app-surface)",
        }}
      >
        <Stack gap="xs" ta="center" mb="xl">
          <Group justify="center" gap="sm">
            <Box
              style={{
                width: 40,
                height: 40,
                background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={20} color="white" />
            </Box>
            <Title order={3} c="var(--app-text-strong)">
              NodeWorks
            </Title>
          </Group>
          <Text c="dimmed" fz="sm">
            Welcome to NodeWorks Client. Let&apos;s find you some talent.
          </Text>
        </Stack>

        <Progress
          value={((activeStep + 1) / steps.length) * 100}
          size="sm"
          radius="xl"
          color="indigo"
          mb="lg"
        />

        <Stepper
          active={activeStep}
          onStepClick={setActiveStep}
          allowNextStepsSelect={false}
          size="sm"
          color="indigo"
          mb="xl"
        >
          <Stepper.Step icon={<Building2 size={16} />} label={steps[0].label} description={steps[0].description} />
          <Stepper.Step icon={<Briefcase size={16} />} label={steps[1].label} description={steps[1].description} />
          <Stepper.Step icon={<CheckCircle2 size={16} />} label={steps[2].label} description={steps[2].description} />
        </Stepper>

        <Box mb="xl">
          {activeStep === 0 && (
            <Stack gap="lg">
              <TextInput
                label="Company Name"
                placeholder="Acme Inc."
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                leftSection={<Building2 size={16} color="var(--app-muted-soft)" />}
                size="md"
                styles={{ label: { color: "var(--app-text)", fontWeight: 600 } }}
              />
              <Select
                label="Industry"
                placeholder="Select your industry"
                required
                data={INDUSTRIES}
                value={industry}
                onChange={setIndustry}
                size="md"
                styles={{ label: { color: "var(--app-text)", fontWeight: 600 } }}
              />
              <Select
                label="Company Size"
                placeholder="How big is your team?"
                required
                data={COMPANY_SIZES}
                value={companySize}
                onChange={setCompanySize}
                size="md"
                styles={{ label: { color: "var(--app-text)", fontWeight: 600 } }}
              />
            </Stack>
          )}

          {activeStep === 1 && (
            <Stack gap="lg">
              <Textarea
                label="Company Description"
                placeholder="What does your company do? What kind of projects do you typically need help with?"
                required
                minRows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                size="md"
                styles={{ label: { color: "var(--app-text)", fontWeight: 600 } }}
              />
              <Text size="xs" c={description.length >= 20 ? "green" : "dimmed"}>
                {description.length}/500 characters (minimum 20)
              </Text>
              <TextInput
                label="Website (optional)"
                placeholder="https://yourcompany.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                leftSection={<Globe size={16} color="var(--app-muted-soft)" />}
                size="md"
                styles={{ label: { color: "var(--app-text)", fontWeight: 600 } }}
              />
            </Stack>
          )}

          {activeStep === 2 && (
            <Stack gap="lg" align="center" py="md">
              <Avatar
                size={80}
                radius="xl"
                color="indigo"
                style={{
                  background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
                }}
              >
                <CheckCircle2 size={40} color="white" />
              </Avatar>
              <Stack gap="xs" ta="center">
                <Title order={4} c="var(--app-text-strong)">
                  You&apos;re all set!
                </Title>
                <Text c="dimmed" fz="sm" maw={360}>
                  Your client profile is ready. You can now post projects and find the perfect freelancers for your needs.
                </Text>
              </Stack>

              <Card withBorder radius="md" bg="var(--app-surface)" w="100%">
                <Stack gap="sm">
                  <Group>
                    <Building2 size={18} color="#4f46e5" />
                    <Text fw={600} c="var(--app-text)">{companyName}</Text>
                  </Group>
                  <Group>
                    <Briefcase size={18} color="#4f46e5" />
                    <Text fz="sm" c="dimmed">{industry}</Text>
                  </Group>
                  <Group>
                    <Users size={18} color="#4f46e5" />
                    <Text fz="sm" c="dimmed">{companySize}</Text>
                  </Group>
                </Stack>
              </Card>
            </Stack>
          )}
        </Box>

        <Group justify="space-between">
          <Button
            variant="default"
            onClick={handleBack}
            disabled={activeStep === 0}
            leftSection={<ArrowLeft size={16} />}
          >
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={
              (activeStep === 0 && !canProceedStep0) ||
              (activeStep === 1 && !canProceedStep1) ||
              loading
            }
            variant="gradient"
            gradient={{ from: "indigo", to: "cyan", deg: 135 }}
            rightSection={
              activeStep === 2 ? undefined : <ArrowRight size={16} />
            }
            loading={loading}
          >
            {activeStep === 2 ? "Enter Dashboard" : "Next"}
          </Button>
        </Group>
      </Card>
    </Box>
  );
}
