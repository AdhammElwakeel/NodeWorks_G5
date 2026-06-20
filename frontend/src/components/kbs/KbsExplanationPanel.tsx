"use client";

import { Badge, Box, Group, Progress, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import { BriefcaseBusiness, GitBranch, Network, Sparkles } from "lucide-react";

function scoreColor(value: number) {
  if (value >= 80) return "green";
  if (value >= 50) return "yellow";
  return "orange";
}

function clampScore(value: number) {
  return Math.min(100, Math.max(0, value));
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
  reason,
  matchedSkills,
  missingSkills,
  graphPath,
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
  const displayScore = score === undefined ? undefined : clampScore(score);
  const roleScore = scoreBreakdown?.roleScore || 0;
  const techScore = scoreBreakdown?.techScore;
  const synergyScore = scoreBreakdown?.synergyScore;
  const knowledgeScore = scoreBreakdown?.knowledgeScore;
  const rawFinalScore = scoreBreakdown?.rawFinalScore;
  const finalScore = scoreBreakdown?.finalScore;
  const hasRecsysBreakdown =
    techScore !== undefined || synergyScore !== undefined || knowledgeScore !== undefined || finalScore !== undefined || rawFinalScore !== undefined;
  const requiredRoles = evidence?.requiredRoles || [];
  const domainKnowledge = evidence?.domainKnowledge || [];
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
        borderRadius: "var(--mantine-radius-xl)",
        background:
          "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(20,184,166,0.08), var(--app-bg))",
        border: "1px solid rgba(148,163,184,0.22)",
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Group gap="xs" align="flex-start">
            <ThemeIcon color={color} variant="light" radius="md" size={32}>
              <GitBranch size={16} />
            </ThemeIcon>
            <Stack gap={1}>
              <Text fz="sm" fw={800} c="var(--app-text)">
                {recommendationLabel(displayScore)}
              </Text>
              <Text fz="xs" c="dimmed">
                Recommended using KBS graph evidence and RecSys ranking
              </Text>
            </Stack>
          </Group>
          {displayScore !== undefined && (
            <Badge size="md" color={scoreColor(displayScore)} variant="filled" radius="md">
              {displayScore}%
            </Badge>
          )}
        </Group>

        {displayScore !== undefined && (
          <Progress value={displayScore} color={scoreColor(displayScore)} radius="xl" size="sm" />
        )}

        {reason && (
          <Text fz="xs" c="dimmed" lineClamp={2}>
            {reason}
          </Text>
        )}

        {hasRecsysBreakdown && (
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={6}>
            <Box p="xs" style={{ borderRadius: "var(--mantine-radius-md)", background: "rgba(255,255,255,0.48)" }}>
              <Text fz={10} c="dimmed" tt="uppercase" fw={800}>Tech Role</Text>
              <Text fz="sm" fw={900} c="var(--app-text)">{techScore ?? 0}</Text>
              <Text fz={10} c="dimmed">normalized role fit</Text>
            </Box>
            <Box p="xs" style={{ borderRadius: "var(--mantine-radius-md)", background: "rgba(255,255,255,0.48)" }}>
              <Text fz={10} c="dimmed" tt="uppercase" fw={800}>Synergy</Text>
              <Text fz="sm" fw={900} c="var(--app-text)">{synergyScore ?? 0}</Text>
              <Text fz={10} c="dimmed">normalized bonus</Text>
            </Box>
            <Box p="xs" style={{ borderRadius: "var(--mantine-radius-md)", background: "rgba(255,255,255,0.48)" }}>
              <Text fz={10} c="dimmed" tt="uppercase" fw={800}>Knowledge</Text>
              <Text fz="sm" fw={900} c="var(--app-text)">{knowledgeScore ?? 0}</Text>
              <Text fz={10} c="dimmed">normalized bonus</Text>
            </Box>
            <Box p="xs" style={{ borderRadius: "var(--mantine-radius-md)", background: "rgba(255,255,255,0.48)" }}>
              <Text fz={10} c="dimmed" tt="uppercase" fw={800}>Final %</Text>
              <Text fz="sm" fw={900} c="var(--app-text)">{finalScore ?? score ?? 0}</Text>
              <Text fz={10} c="dimmed">raw {rawFinalScore ?? finalScore ?? score ?? 0}</Text>
            </Box>
          </SimpleGrid>
        )}

        {(matchedSkills.length > 0 || visibleExperience.length > 0 || visibleProjectEvidence.length > 0 || requiredRoles.length > 0 || domainKnowledge.length > 0) && (
          <Box
            p="sm"
            style={{
              borderRadius: "var(--mantine-radius-lg)",
              background: "rgba(255,255,255,0.45)",
              border: "1px solid rgba(148,163,184,0.18)",
            }}
          >
            <Stack gap="xs">
              <Text fz="xs" fw={900} c="var(--app-text)" tt="uppercase">
                Why this match is recommended
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={6}>
                {matchedSkills.length > 0 && (
                  <Group gap={6} wrap="nowrap" align="flex-start">
                    <Sparkles size={14} color={`var(--mantine-color-${color}-6)`} />
                    <Text fz="xs" c="dimmed">
                      Matched skills: {matchedSkills.join(", ")}
                    </Text>
                  </Group>
                )}
                {requiredRoles.length > 0 && roleScore > 0 && (
                  <Group gap={6} wrap="nowrap" align="flex-start">
                    <Network size={14} color="var(--mantine-color-teal-6)" />
                    <Text fz="xs" c="dimmed">
                      Role fit: {requiredRoles.join(", ")}
                    </Text>
                  </Group>
                )}
                {domainKnowledge.length > 0 && (
                  <Group gap={6} wrap="nowrap" align="flex-start">
                    <Network size={14} color="var(--mantine-color-indigo-6)" />
                    <Text fz="xs" c="dimmed">
                      Domain knowledge: {domainKnowledge.slice(0, 6).join(", ")}
                      {domainKnowledge.length > 6 ? ` +${domainKnowledge.length - 6} more` : ""}
                    </Text>
                  </Group>
                )}
                {visibleExperience.map((item, index) => (
                  <Group key={`${item.company}-${item.role}-${index}`} gap={6} wrap="nowrap" align="flex-start">
                    <BriefcaseBusiness size={14} color="var(--mantine-color-blue-6)" />
                    <Text fz="xs" c="dimmed">
                      Experience: {formatExperience(item)}
                    </Text>
                  </Group>
                ))}
                {visibleProjectEvidence.map((item, index) => (
                  <Group key={`${item.project}-${item.technology}-${index}`} gap={6} wrap="nowrap" align="flex-start">
                    <GitBranch size={14} color="var(--mantine-color-violet-6)" />
                    <Text fz="xs" c="dimmed">
                      CV evidence: {item.project || "CV project"} used {item.technology}
                    </Text>
                  </Group>
                ))}
              </SimpleGrid>
              {projectEvidenceSkills.length > 0 && (
                <Group gap={4} wrap="wrap">
                  <Text fz="xs" fw={700} c="dimmed">Evidence skills:</Text>
                  {projectEvidenceSkills.map((skill) => (
                    <Badge key={skill} size="xs" color="teal" variant="light">
                      {skill}
                    </Badge>
                  ))}
                </Group>
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

        <Text fz={10} c="dimmed" opacity={0.75}>
          Graph path: {graphPath}
        </Text>
      </Stack>
    </Box>
  );
}
