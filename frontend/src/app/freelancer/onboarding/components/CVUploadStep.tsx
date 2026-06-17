"use client";

import {
  Badge,
  Card,
  FileInput,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Alert,
} from "@mantine/core";
import { FileText, CheckCircle, AlertCircle, Brain } from "lucide-react";

const fieldLabelStyles = {
  label: { color: "var(--app-text)", fontWeight: 600 },
  required: { color: "var(--app-text)" },
  input: { color: "var(--app-text)" },
};

export interface CvData {
  name?: string;
  email?: string;
  phone?: string;
  headline?: string;
  "years of experience"?: string;
  all_skills?: string[];
  experience?: { role: string; company: string; years: string }[];
  education?: {
    degree: string;
    institution: string;
    technologies?: string[];
  }[];
  projects?: { name: string; technologies?: string[] }[];
  certifications?: { name: string; technologies?: string[] }[];
  Publications?: { name: string; technologies?: string[] }[];
  best_role?: string;
  best_score?: number;
  role_confidence_status?: "confident" | "needs_user_input";
  role_confidence_threshold?: number;
  role_rankings?: {
    role: string;
    score: number;
    matched_skills?: string[];
    missing_skills?: string[];
  }[];
}

function formatExperienceItem(item: { role?: string; company?: string; years?: string }) {
  const role = item.role?.trim();
  const company = item.company?.trim();
  const years = item.years?.trim();

  if (role && company && years) return `${role} at ${company} (${years})`;
  if (role && company) return `${role} at ${company}`;
  if (role && years) return `${role} (${years})`;
  return role || company || years || "Past experience";
}

interface CVUploadStepProps {
  cvExtracted: boolean;
  cvFileName: string | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  analysisDebug: Record<string, unknown> | null;
  cvData: CvData | null;
  onUpload: (file: File | null) => void;
}

export function CVUploadStep({
  cvExtracted,
  cvFileName,
  isAnalyzing,
  analysisError,
  analysisDebug,
  cvData,
  onUpload,
}: CVUploadStepProps) {
  return (
    <Paper withBorder radius="md" p="lg" bg="var(--app-surface)">
      <Stack gap="lg">
        <Group>
          <ThemeIcon size={46} radius="md" color="blue" variant="light">
            <FileText size={24} />
          </ThemeIcon>
          <Stack gap={0}>
            <Title order={3} c="var(--app-text-strong)">
              CV extraction
            </Title>
            <Text c="var(--app-text)" fz="sm">
              Upload your PDF and let AI extract your profile details
              automatically.
            </Text>
          </Stack>
        </Group>

        <FileInput
          label="Upload your CV"
          placeholder="Select your CV file (.pdf)"
          accept=".pdf"
          onChange={onUpload}
          size="md"
          styles={fieldLabelStyles}
          disabled={isAnalyzing}
        />

        {analysisDebug !== null && (
          <Card withBorder radius="md" p="sm" bg="var(--app-bg)">
            <Stack gap={6}>
              <Group justify="space-between">
                <Text fw={700} fz="sm" c="var(--app-text)">
                  CV analysis debug response
                </Text>
                <Badge color={analysisError ? "red" : "green"} variant="light">
                  {analysisError ? "Error" : "OK"}
                </Badge>
              </Group>
              <pre
                style={{
                  margin: 0,
                  maxHeight: 320,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontSize: 12,
                  color: "var(--app-text)",
                }}
              >
                {JSON.stringify(analysisDebug, null, 2)}
              </pre>
            </Stack>
          </Card>
        )}

        {/* Analyzing state */}
        {isAnalyzing && (
          <Card withBorder radius="md" p="md" bg="var(--app-active-bg)">
            <Group>
              <Loader size="sm" color="blue" />
              <Stack gap={2}>
                <Text fw={600} c="var(--app-text)" fz="sm">
                  Analyzing your CV with AI…
                </Text>
                <Text fz="xs" c="dimmed">
                  extracting your skills, experience and role match.
                </Text>
              </Stack>
            </Group>
          </Card>
        )}

        {/* Error state */}
        {analysisError && !isAnalyzing && (
          <Alert
            icon={<AlertCircle size={16} />}
            title="Analysis failed"
            color="red"
            radius="md"
          >
            {analysisError}
          </Alert>
        )}

        {/* Success state */}
        {cvExtracted && cvData && !isAnalyzing && (
          <Card withBorder radius="md" p="md" bg="var(--app-active-bg)">
            <Stack gap="sm">
              <Group justify="space-between">
                <Group gap="xs">
                  <CheckCircle size={18} color="var(--mantine-color-teal-6)" />
                  <Text fw={600} c="var(--app-text)">
                    CV Analysis Complete
                  </Text>
                </Group>
                <Badge color="cyan" variant="light">
                  Ready
                </Badge>
              </Group>

              <Text fz="sm" c="var(--app-text)">
                <strong>{cvFileName}</strong> processed successfully. The form
                on the next step will use only confident CV data.
              </Text>

              {!cvData.headline && (
                <Alert color="yellow" variant="light" icon={<AlertCircle size={16} />}>
                  The AI could not find a clear professional headline in this CV. Please enter your headline manually in the next step.
                </Alert>
              )}

              {cvData.role_confidence_status === "needs_user_input" && (
                <Alert color="yellow" variant="light" icon={<AlertCircle size={16} />}>
                  The AI could not detect a confident professional role from this CV. It will not be used as your headline.
                </Alert>
              )}

              <Group gap="xs" wrap="wrap">
                {cvData.headline && (
                  <Badge color="blue" variant="light" size="md">
                    Headline: {cvData.headline}
                  </Badge>
                )}

                {/* Best Role */}
                {cvData.best_role && (
                  <Badge
                    leftSection={<Brain size={12} />}
                    color="indigo"
                    variant="light"
                    size="md"
                  >
                    Best Match: {cvData.best_role}
                  </Badge>
                )}
                {!cvData.best_role && cvData.role_confidence_status === "needs_user_input" && (
                  <Badge
                    leftSection={<Brain size={12} />}
                    color="yellow"
                    variant="light"
                    size="md"
                  >
                    Role needs manual input
                  </Badge>
                )}

                {/* Skill count */}
                {cvData.all_skills && cvData.all_skills.length > 0 && (
                  <Badge color="teal" variant="light" size="md">
                    {cvData.all_skills.length} skills extracted
                  </Badge>
                )}

                {/* Experience */}
                {cvData["years of experience"] && (
                  <Badge color="blue" variant="light" size="md">
                    {cvData["years of experience"]} experience
                  </Badge>
                )}
              </Group>

              {cvData.experience && cvData.experience.length > 0 && (
                <Card withBorder radius="md" p="sm" bg="var(--app-surface)">
                  <Stack gap={6}>
                    <Text fw={700} fz="sm" c="var(--app-text)">
                      Past experience detected
                    </Text>
                    {cvData.experience.slice(0, 4).map((item, index) => (
                      <Text key={`${item.role}-${item.company}-${index}`} fz="xs" c="dimmed">
                        - {formatExperienceItem(item)}
                      </Text>
                    ))}
                  </Stack>
                </Card>
              )}
            </Stack>
          </Card>
        )}

        {/* Pending state (no file selected yet) */}
        {!cvExtracted && !isAnalyzing && !analysisError && (
          <Card withBorder radius="md" p="md" bg="var(--app-surface)">
            <Group justify="space-between">
              <Text fw={600} c="var(--app-text)">
                CV upload status
              </Text>
              <Badge color="gray" variant="light">
                Pending
              </Badge>
            </Group>
            <Text fz="sm" c="var(--app-text)" mt={6}>
              Upload your CV to continue to the next step.
            </Text>
          </Card>
        )}
      </Stack>
    </Paper>
  );
}
