"use client";

import { Container, Box, Stack, Title, Text, Button, Group, Card, useMantineColorScheme } from "@mantine/core";
import { ArrowRight, Sparkles } from "lucide-react";

export function CTASection() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  return (
    <Box
      component="section"
      py={{ base: 80, md: 100, lg: 120 }}
    >
      <Container size="md">
        <Card
          radius="xl"
          p={{ base: "xl", md: 48 }}
          shadow="xl"
          bg={isDark ? "dark.7" : "white"}
          style={{
            border: isDark ? "1px solid var(--mantine-color-dark-4)" : "1px solid var(--mantine-color-gray-2)",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 20px 25px -5px rgba(0, 0, 0, 0.08)",
          }}
        >
          <Stack gap="xl" align="center" ta="center">
            {/* Badge */}
            <Group
              gap="xs"
              px="md"
              py={6}
              style={{
                background: "var(--mantine-color-indigo-0)",
                borderRadius: "var(--mantine-radius-xl)",
                border: "1px solid var(--mantine-color-indigo-2)",
              }}
            >
              <Sparkles size={14} color="var(--mantine-color-indigo-6)" />
              <Text fz="xs" fw={600} c="indigo.6" tt="uppercase" style={{ letterSpacing: "0.5px" }}>
                Join the Future of Work
              </Text>
            </Group>

            {/* Heading */}
            <Stack gap="sm">
              <Title order={2} fz={{ base: 28, md: 40 }} fw={800} c="dark" lh={1.2}>
                Ready to Get Started?
              </Title>
              <Text fz={{ base: "md", md: "lg" }} c="dimmed" maw={450} lh={1.6}>
                Join thousands of freelancers and clients already using NodeWorks to build amazing things together.
              </Text>
            </Stack>

            {/* CTA Buttons */}
            <Group gap="md" mt="md">
              <Button
                size="lg"
                variant="gradient"
                gradient={{ from: "indigo", to: "blue", deg: 135 }}
                rightSection={<ArrowRight size={18} />}
                px="xl"
              >
                Start Your Journey
              </Button>
              <Button
                size="lg"
                variant="light"
                color="gray"
                px="xl"
              >
                Learn More
              </Button>
            </Group>

            {/* Trust indicators */}
            <Text fz="xs" c="dimmed" mt="sm">
              No credit card required  •  Free 14-day trial  •  Cancel anytime
            </Text>
          </Stack>
        </Card>
      </Container>
    </Box>
  );
}
