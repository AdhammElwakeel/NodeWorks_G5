"use client";

import { Container, Title, Text, Button, Group, Stack, Image, Box, Grid } from "@mantine/core";
import { Play } from "lucide-react";

export function HeroSection() {
  return (
    <Box
      component="section"
      py={{ base: 60, md: 80, lg: 100 }}
      style={{
        background:
          "linear-gradient(135deg, var(--app-bg), rgba(6, 182, 212, 0.08), rgba(79, 70, 229, 0.14))",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background decoration */}
      <Box
        style={{
          position: "absolute",
          top: -160,
          right: -160,
          width: 320,
          height: 320,
          background: "var(--mantine-color-indigo-2)",
          borderRadius: "50%",
          opacity: 0.3,
          filter: "blur(60px)",
        }}
      />
      <Box
        style={{
          position: "absolute",
          bottom: -160,
          left: -160,
          width: 320,
          height: 320,
          background: "var(--mantine-color-blue-2)",
          borderRadius: "50%",
          opacity: 0.3,
          filter: "blur(60px)",
        }}
      />

      <Container size="xl" style={{ position: "relative", zIndex: 1 }}>
        <Grid gap={{ base: 40, md: 60 }} align="center">
          {/* Left Content */}
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Stack gap="xl">
              <Stack gap="md">
                <Title
                  order={1}
                  fz={{ base: 36, md: 44, lg: 52 }}
                  fw={700}
                  c="var(--app-text-strong)"
                  lh={1.2}
                >
                  Find Perfect Talent with{" "}
                  <Text
                    component="span"
                    variant="gradient"
                    gradient={{ from: "indigo", to: "blue", deg: 135 }}
                    inherit
                  >
                    AI Matching
                  </Text>
                </Title>
                <Text fz="lg" c="dimmed" maw={500} lh={1.7}>
                  Connect verified freelancers with clients through intelligent
                  matching, automated verification, and seamless collaboration.
                </Text>
              </Stack>

              {/* CTA Buttons */}
              <Group gap="md">
                <Button
                  size="lg"
                  variant="gradient"
                  gradient={{ from: "indigo", to: "blue", deg: 135 }}
                  px="xl"
                >
                  Get Started Free
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  color="gray"
                  leftSection={<Play size={16} />}
                >
                  Watch Demo
                </Button>
              </Group>
            </Stack>
          </Grid.Col>

          {/* Right Image */}
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <Box style={{ position: "relative" }}>
              <Box
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(135deg, var(--mantine-color-indigo-5), var(--mantine-color-blue-6))",
                  borderRadius: "var(--mantine-radius-lg)",
                  transform: "rotate(3deg)",
                  opacity: 0.1,
                }}
              />
              <Image
                src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&auto=format&fit=crop&w=1080&q=80"
                alt="Team collaboration"
                radius="lg"
                style={{
                  position: "relative",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                }}
                fallbackSrc="https://placehold.co/600x400/e2e8f0/64748b?text=FreelanceAI"
              />
            </Box>
          </Grid.Col>
        </Grid>
      </Container>
    </Box>
  );
}
