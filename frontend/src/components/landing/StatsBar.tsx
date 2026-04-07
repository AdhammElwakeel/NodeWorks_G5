"use client";

import { Container, Box, SimpleGrid, Stack, Text, Card, ThemeIcon } from "@mantine/core";
import { Users, Smile, Target, DollarSign } from "lucide-react";

const stats = [
  {
    icon: Users,
    value: "10K+",
    label: "Verified Freelancers",
    color: "indigo",
  },
  {
    icon: Smile,
    value: "5K+",
    label: "Happy Clients",
    color: "blue",
  },
  {
    icon: Target,
    value: "95%",
    label: "Match Accuracy",
    color: "violet",
  },
  {
    icon: DollarSign,
    value: "$2M+",
    label: "Paid to Freelancers",
    color: "teal",
  },
];

export function StatsBar() {
  return (
    <Box component="section" py={{ base: 60, md: 80 }}>
      <Container size="xl">
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing={{ base: "md", md: "xl" }}>
          {stats.map((stat) => {
            const IconComponent = stat.icon;
            return (
              <Card
                key={stat.label}
                p={{ base: "lg", md: "xl" }}
                radius="lg"
                shadow="sm"
                style={{
                  border: "1px solid var(--mantine-color-gray-2)",
                }}
              >
                <Stack gap="md" align="center" ta="center">
                  <ThemeIcon
                    size={56}
                    radius="xl"
                    variant="light"
                    color={stat.color}
                  >
                    <IconComponent size={28} />
                  </ThemeIcon>
                  <Stack gap={4}>
                    <Text
                      fz={{ base: 28, md: 36 }}
                      fw={700}
                      variant="gradient"
                      gradient={{ from: "indigo", to: "blue", deg: 135 }}
                      lh={1}
                    >
                      {stat.value}
                    </Text>
                    <Text fz="sm" c="dimmed" fw={500}>
                      {stat.label}
                    </Text>
                  </Stack>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      </Container>
    </Box>
  );
}
