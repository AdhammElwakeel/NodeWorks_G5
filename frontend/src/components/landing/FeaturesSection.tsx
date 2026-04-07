import { Container, SimpleGrid, Stack, Title, Text, Box } from "@mantine/core";
import {
  Brain,
  ShieldCheck,
  MessageSquare,
  Users,
  BarChart3,
  BadgeCheck,
} from "lucide-react";
import { FeatureCard } from "./FeatureCard";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Matching",
    description:
      "Our advanced algorithms analyze skills, experience, and project requirements to find the perfect match every time.",
  },
  {
    icon: ShieldCheck,
    title: "Automated Verification",
    description:
      "Every freelancer goes through OTP verification, CV analysis, and AI-proctored interviews for quality assurance.",
  },
  {
    icon: MessageSquare,
    title: "Instant Collaboration",
    description:
      "Start working immediately with built-in chat, document sharing, and project tracking tools.",
  },
  {
    icon: Users,
    title: "Team Formation",
    description:
      "Build complementary teams with knowledge graph visualization and synergy score analysis.",
  },
  {
    icon: BarChart3,
    title: "Smart Analytics",
    description:
      "Track performance, earnings, and project progress with comprehensive dashboards and insights.",
  },
  {
    icon: BadgeCheck,
    title: "Verified Profiles",
    description:
      "AI badge system showcases freelancer competency and helps clients make confident hiring decisions.",
  },
];

export function FeaturesSection() {
  return (
    <Box component="section" py={{ base: 60, md: 80, lg: 100 }} bg="white">
      <Container size="xl">
        <Stack gap="xl">
          {/* Section Header */}
          <Stack gap="sm" align="center" ta="center" mb="xl">
            <Title order={2} fz={{ base: 28, md: 36 }} fw={700} c="dark">
              Everything You Need to Succeed
            </Title>
            <Text fz="lg" c="dimmed" maw={600}>
              Powerful features designed to streamline your freelance journey
            </Text>
          </Stack>

          {/* Feature Cards Grid */}
          <SimpleGrid
            cols={{ base: 1, sm: 2, lg: 3 }}
            spacing={{ base: "md", md: "lg" }}
          >
            {features.map((feature) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
}
