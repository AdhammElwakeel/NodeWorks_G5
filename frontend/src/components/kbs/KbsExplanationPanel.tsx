"use client";

import { Badge, Box, Group, Stack, Text } from "@mantine/core";
import { GitBranch } from "lucide-react";

function formatEvidenceLabel(value: string) {
  return value
    .replace(/Score$/, "")
    .replace(/Skills$/, "")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function formatSnakeLabel(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (char) => char.toUpperCase());
}

function scoreColor(value: number) {
  if (value >= 80) return "green";
  if (value >= 55) return "yellow";
  return "orange";
}

function scoreTone(value?: number) {
  if (value === undefined) return "Candidate has some matching evidence, but the score is not available.";
  if (value >= 80) return "Strong fit based on graph evidence, weighted scoring, and AI validation.";
  if (value >= 55) return "Possible fit with useful evidence, but some hiring details still need confirmation.";
  return "Weak fit unless the missing evidence can be confirmed manually.";
}

function isTechnicalFact(fact: string) {
  return fact.startsWith("RecSys ") || fact.startsWith("Project requires role:");
}

export function KbsExplanationPanel({
  score,
  reason,
  matchedSkills,
  missingSkills,
  graphPath,
  scoreBreakdown,
  evidence,
  evidenceFacts,
  llmEvaluation,
  color = "violet",
}: {
  score?: number;
  reason: string;
  matchedSkills: string[];
  missingSkills?: string[];
  graphPath: string;
  scoreBreakdown?: Record<string, number | undefined>;
  evidence?: Record<string, string[] | undefined>;
  evidenceFacts?: string[];
  llmEvaluation?: {
    fitScore: number;
    confidence: "low" | "medium" | "high";
    recommendation: "strong_fit" | "good_fit" | "possible_fit" | "not_recommended";
    reason: string;
    evidenceUsed: string[];
    risks: string[];
    clientQuestions: string[];
  };
  color?: string;
}) {
  const finalScore = score ?? llmEvaluation?.fitScore;
  const verdict = llmEvaluation
    ? formatSnakeLabel(llmEvaluation.recommendation)
    : "KBS recommendation";
  const finalReason = llmEvaluation?.reason || reason;
  const breakdownEntries = Object.entries(scoreBreakdown || {}).filter(
    ([, value]) => typeof value === "number"
  );
  const evidenceEntries = Object.entries(evidence || {}).filter(
    ([, values]) => Array.isArray(values) && values.length > 0
  );
  const validatedEvidence = llmEvaluation?.evidenceUsed?.length
    ? llmEvaluation.evidenceUsed
    : matchedSkills.map((skill) => `Matched required skill: ${skill}`);
  const graphFacts = (evidenceFacts || []).filter((fact) => !isTechnicalFact(fact)).slice(0, 5);
  const signalEntries = breakdownEntries.filter(([key]) =>
    ["skillScore", "experienceScore", "projectEvidenceScore", "roleScore", "availabilityScore", "budgetFitScore"].includes(key)
  );

  return (
    <Box
      p="md"
      style={{
        borderRadius: "var(--mantine-radius-lg)",
        background:
          "linear-gradient(135deg, var(--app-bg), rgba(124, 58, 237, 0.06))",
        border: "1px solid var(--app-border)",
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" gap="sm">
          <Group gap="xs" align="flex-start">
            <Box
              p={6}
              style={{
                borderRadius: "var(--mantine-radius-md)",
                background: `var(--mantine-color-${color}-0)`,
                border: `1px solid var(--mantine-color-${color}-2)`,
              }}
            >
              <GitBranch size={15} color={`var(--mantine-color-${color}-6)`} />
            </Box>
            <Stack gap={1}>
              <Text fz="sm" fw={800} c="var(--app-text)">
                Final Hiring Decision
              </Text>
              <Text fz="xs" c="dimmed">
                KBS graph evidence, RecSys ranking, and AI judge combined into one result
              </Text>
            </Stack>
          </Group>
          {finalScore !== undefined && (
            <Badge size="md" color={scoreColor(finalScore)} variant="filled" radius="md">
              {Math.round(finalScore)}%
            </Badge>
          )}
        </Group>

        <Box
          p="sm"
          style={{
            borderRadius: "var(--mantine-radius-md)",
            background: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.22)",
          }}
        >
          <Stack gap={6}>
            <Group justify="space-between" align="center" gap="xs">
              <Text fz="sm" fw={800} c="var(--app-text)">
                {verdict}
              </Text>
              {llmEvaluation && (
                <Badge size="xs" color="blue" variant="light">
                  {llmEvaluation.confidence} confidence
                </Badge>
              )}
            </Group>
            <Text fz="xs" c="var(--app-text)" lh={1.45}>
              {scoreTone(finalScore)} {finalReason}
            </Text>
            <Text fz="xs" c="dimmed" lh={1.45}>
              The graph found the facts, RecSys weighted them, then the AI judge checked whether the evidence supports the final hiring result.
            </Text>
          </Stack>
        </Box>

        {validatedEvidence.length > 0 && (
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
                Why this result
              </Text>
              {validatedEvidence.slice(0, 4).map((item) => (
                <Text key={item} fz="xs" c="dimmed" lh={1.35}>
                  - {item}
                </Text>
              ))}
              {graphFacts.slice(0, 3).map((fact) => (
                <Text key={fact} fz="xs" c="dimmed" lh={1.35}>
                  - {fact}
                </Text>
              ))}
            </Stack>
          </Box>
        )}

        {llmEvaluation && llmEvaluation.risks.length > 0 && (
          <Box
            p="xs"
            style={{
              borderRadius: "var(--mantine-radius-md)",
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
            }}
          >
            <Text fz="xs" fw={800} c="orange" mb={3}>
              What to confirm before hiring
            </Text>
            <Text fz="xs" c="orange" lh={1.4}>
              {llmEvaluation.risks.slice(0, 2).join(" ")}
            </Text>
            {llmEvaluation.clientQuestions.length > 0 && (
              <Text fz="xs" c="dimmed" mt={5} lh={1.4}>
                Ask: {llmEvaluation.clientQuestions.slice(0, 2).join(" ")}
              </Text>
            )}
          </Box>
        )}

        {missingSkills && missingSkills.length > 0 && (
          <Box
            p="xs"
            style={{
              borderRadius: "var(--mantine-radius-md)",
              background: "rgba(239, 68, 68, 0.07)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            <Text fz="xs" fw={800} c="red" mb={3}>
              Missing evidence
            </Text>
            <Text fz="xs" c="red" lh={1.4}>
              {missingSkills.join(", ")}
            </Text>
          </Box>
        )}

        {signalEntries.length > 0 && (
          <Box
            p="xs"
            style={{
              borderRadius: "var(--mantine-radius-md)",
              background: "var(--app-surface)",
              border: "1px solid var(--app-border)",
            }}
          >
            <Stack gap={6}>
              <Text fz="xs" fw={800} c="var(--app-text)">
                Score signals
              </Text>
              <Group gap={5} wrap="wrap">
                {signalEntries.map(([key, value]) => {
                  const numericValue = Number(value || 0);
                  return (
                    <Badge key={key} size="xs" color={scoreColor(numericValue)} variant="light">
                      {formatEvidenceLabel(key)} {numericValue.toFixed(0)}%
                    </Badge>
                  );
                })}
              </Group>
            </Stack>
          </Box>
        )}

        {evidenceEntries.length > 0 && (
          <Group gap={4} wrap="wrap">
            {evidenceEntries.flatMap(([key, values]) =>
              (values || []).slice(0, 4).map((item) => (
                <Badge key={`${key}-${item}`} size="xs" color={color} variant="outline">
                  {formatEvidenceLabel(key)}: {item}
                </Badge>
              ))
            )}
          </Group>
        )}

        <Text fz="10px" c="dimmed" lh={1.35}>
          Evidence source: {graphPath}
        </Text>
      </Stack>
    </Box>
  );
}
