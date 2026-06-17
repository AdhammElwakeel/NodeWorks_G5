"use client";

import { Badge, Box, Group, Stack, Text } from "@mantine/core";
import { GitBranch } from "lucide-react";

function scoreColor(value: number) {
  if (value >= 80) return "green";
  if (value >= 50) return "yellow";
  return "orange";
}

function recommendationLabel(value?: number) {
  if (value === undefined) return "Best match";
  if (value >= 80) return "Excellent match";
  if (value >= 65) return "Best match";
  return "Potential match";
}

function formatExperience(item: { company?: string; role?: string; duration?: string }) {
  const role = item.role?.trim();
  const company = item.company?.trim();
  const duration = item.duration?.trim();

  if (role && company && duration) return `${role} at ${company} (${duration})`;
  if (role && company) return `${role} at ${company}`;
  if (role && duration) return `${role} (${duration})`;
  return role || company || duration || "Past experience";
}

export function KbsExplanationPanel({
  score,
  reason: _reason,
  matchedSkills,
  missingSkills,
  graphPath: _graphPath,
  scoreBreakdown,
  evidence,
  experienceDetails,
  relevantExperienceDetails,
  projectEvidenceDetails,
  color = "violet",
}: {
  score?: number;
  reason: string;
  matchedSkills: string[];
  missingSkills?: string[];
  graphPath: string;
  scoreBreakdown?: Record<string, number | undefined>;
  evidence?: Record<string, string[] | undefined>;
  experienceDetails?: { company?: string; role?: string; duration?: string }[];
  relevantExperienceDetails?: { company?: string; role?: string; duration?: string }[];
  projectEvidenceDetails?: { project?: string; technology?: string }[];
  color?: string;
}) {
  const roleScore = scoreBreakdown?.roleScore || 0;
  const requiredRoles = evidence?.requiredRoles || [];
  const projectEvidenceSkills = evidence?.projectEvidenceSkills || [];
  const visibleExperience = (relevantExperienceDetails?.length
    ? relevantExperienceDetails
    : experienceDetails || []
  ).slice(0, 3);
  const visibleProjectEvidence = (projectEvidenceDetails || []).slice(0, 3);

  return (
    <Box
      p="md"
      style={{
        borderRadius: "var(--mantine-radius-lg)",
        background:
          "linear-gradient(135deg, var(--app-bg), rgba(20, 184, 166, 0.06))",
        border: "1px solid var(--app-border)",
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Group gap="xs" align="flex-start">
            <GitBranch size={14} color={`var(--mantine-color-${color}-6)`} />
            <Stack gap={1}>
              <Text fz="sm" fw={800} c="var(--app-text)">
                {recommendationLabel(score)}
              </Text>
              <Text fz="xs" c="dimmed">
                Recommended using KBS graph evidence and RecSys ranking
              </Text>
            </Stack>
          </Group>
          {score !== undefined && (
            <Badge size="md" color={scoreColor(score)} variant="filled" radius="md">
              {score}%
            </Badge>
          )}
        </Group>

        {(matchedSkills.length > 0 || visibleExperience.length > 0 || visibleProjectEvidence.length > 0 || requiredRoles.length > 0) && (
          <Box
            p="xs"
            style={{
              borderRadius: "var(--mantine-radius-md)",
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.22)",
            }}
          >
            <Stack gap={5}>
              <Text fz="xs" fw={800} c="var(--app-text)">
                Why this candidate is recommended
              </Text>
              {matchedSkills.length > 0 && (
                <Text fz="xs" c="dimmed">
                  Matched required skills: {matchedSkills.join(", ")}
                </Text>
              )}
              {requiredRoles.length > 0 && roleScore > 0 && (
                <Text fz="xs" c="dimmed">
                  Role matches project need: {requiredRoles.join(", ")}
                </Text>
              )}
              {visibleExperience.map((item, index) => (
                <Text key={`${item.company}-${item.role}-${index}`} fz="xs" c="dimmed">
                  Past experience: {formatExperience(item)}
                </Text>
              ))}
              {visibleProjectEvidence.map((item, index) => (
                <Text key={`${item.project}-${item.technology}-${index}`} fz="xs" c="dimmed">
                  CV project evidence: {item.project || "CV project"} used {item.technology}
                </Text>
              ))}
              {projectEvidenceSkills.length > 0 && (
                <Text fz="xs" c="dimmed">
                  Project evidence skills: {projectEvidenceSkills.join(", ")}
                </Text>
              )}
            </Stack>
          </Box>
        )}

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
