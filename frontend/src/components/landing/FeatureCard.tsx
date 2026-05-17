import { Card, Stack, Text, Title, Box } from "@mantine/core";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <Card
      shadow="sm"
      padding="xl"
      radius="lg"
      h="100%"
      style={{
        border: "1px solid var(--mantine-color-gray-2)",
        transition: "all 0.3s ease",
      }}
      styles={{
        root: {
          "&:hover": {
            boxShadow: "var(--mantine-shadow-lg)",
            borderColor: "var(--mantine-color-indigo-2)",
          },
        },
      }}
    >
      <Stack gap="md">
        {/* Icon */}
        <Box
          w={48}
          h={48}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, var(--mantine-color-indigo-5), var(--mantine-color-blue-6))",
            borderRadius: "var(--mantine-radius-md)",
          }}
        >
          <Icon size={24} color="white" />
        </Box>

        {/* Title */}
        <Title order={4} c="var(--app-text)">
          {title}
        </Title>

        {/* Description */}
        <Text fz="sm" c="dimmed" lh={1.7}>
          {description}
        </Text>
      </Stack>
    </Card>
  );
}
