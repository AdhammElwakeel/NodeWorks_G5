"use client";

import { Badge, Box, Group, Stack, Text } from "@mantine/core";
import { GitBranch } from "lucide-react";

export function KbsExplanationPanel({
  score,
  reason,
  matchedSkills,
  missingSkills,
  graphPath,
  color = "violet",
}: {
  score?: number;
  reason: string;
  matchedSkills: string[];
  missingSkills?: string[];
  graphPath: string;
  color?: string;
}) {
  return (
    <Box
      p="sm"
      style={{
        borderRadius: "var(--mantine-radius-md)",
        background: "var(--app-bg)",
        border: "1px solid var(--app-border)",
      }}
    >
      <Stack gap={6}>
        <Group justify="space-between" align="center">
          <Group gap={6}>
            <GitBranch size={14} color={`var(--mantine-color-${color}-6)`} />
            <Text fz="xs" fw={700} c="var(--app-text)">
              KBS explanation
            </Text>
          </Group>
          {score !== undefined && (
            <Badge size="xs" color={color} variant="light">
              {score}%
            </Badge>
          )}
        </Group>

        <Text fz="xs" c="dimmed">
          {reason}
        </Text>
        <Text fz="xs" c="dimmed">
          Graph path: {graphPath}
        </Text>

        {matchedSkills.length > 0 && (
          <Group gap={4} wrap="wrap">
            {matchedSkills.map((skill) => (
              <Badge key={skill} size="xs" color={color} variant="light">
                {skill}
              </Badge>
            ))}
          </Group>
        )}

        {missingSkills && missingSkills.length > 0 && (
          <Text fz="xs" c="orange">
            Missing: {missingSkills.join(", ")}
          </Text>
        )}
      </Stack>
    </Box>
  );
}
