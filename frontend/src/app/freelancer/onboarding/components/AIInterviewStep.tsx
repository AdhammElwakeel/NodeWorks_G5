"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  List,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  AlertCircle,
  Briefcase,
  Cpu,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { interviewApi } from "@/lib/api";
import type { CvData } from "./CVUploadStep";

type InterviewQuestion = {
  question_text: string;
  focus_concept?: string;
  skill_name?: string;
  is_followup?: boolean;
  followup_number?: number;
  question_number?: number;
  total_questions?: number;
};

type InterviewReport = {
  session_id: string;
  candidate_id: string;
  overall_score: number;
  is_verified: boolean;
  total_questions: number;
  cheating_detected: boolean;
  skill_scores: Array<{
    skill: string;
    score: number;
    questions_asked: number;
  }>;
};

interface AIInterviewStepProps {
  cvData: CvData | null;
}

function buildInterviewPayload(cvData: CvData) {
  return {
    name: cvData.name,
    email: cvData.email,
    phone: cvData.phone,
    all_skills: cvData.all_skills ?? [],
    experience: cvData.experience ?? [],
    education: cvData.education ?? [],
    projects: cvData.projects ?? [],
    certifications: cvData.certifications ?? [],
    publications: cvData.Publications ?? [],
    Publications: cvData.Publications ?? [],
    best_role: cvData.best_role,
    best_score: cvData.best_score,
    role_rankings: cvData.role_rankings ?? [],
  };
}

export function AIInterviewStep({ cvData }: AIInterviewStepProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] =
    useState<InterviewQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasQuestion = currentQuestion !== null;
  const isFinished = report !== null;

  const handleStart = async () => {
    if (!cvData) {
      setError("Upload and analyze your CV before starting the interview.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = (await interviewApi.start({
        candidateId: cvData.email || cvData.name,
        cvData: buildInterviewPayload(cvData),
      })) as {
        session_id: string;
        first_question: InterviewQuestion | null;
      };

      setSessionId(response.session_id);
      setCurrentQuestion(response.first_question);
      setReport(null);
      setAnswer("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to start the interview session.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!sessionId || !answer.trim()) {
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = (await interviewApi.submitAnswer({
        sessionId,
        answer,
      })) as {
        status: "in_progress" | "completed";
        next_question: InterviewQuestion | null;
        report: InterviewReport | null;
      };

      setAnswer("");

      if (response.status === "completed" && response.report) {
        setCurrentQuestion(null);
        setReport(response.report);

        // Save interview results to profile
        setSaving(true);
        try {
          await interviewApi.saveResult({
            sessionId: response.report.session_id,
            overallScore: response.report.overall_score,
            isVerified: response.report.is_verified,
            totalQuestions: response.report.total_questions,
            cheatingDetected: response.report.cheating_detected,
            skillScores: response.report.skill_scores.map((s) => ({
              skill: s.skill,
              score: s.score,
              questionsAsked: s.questions_asked,
            })),
          });
        } catch (saveError) {
          console.warn("Failed to save interview results:", saveError);
        } finally {
          setSaving(false);
        }
        return;
      }

      setCurrentQuestion(response.next_question);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to submit your answer.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper withBorder radius="md" p="lg" bg="var(--app-surface)">
      <Stack gap="lg">
        <Group>
          <ThemeIcon size={46} radius="md" color="cyan" variant="light">
            <Cpu size={24} />
          </ThemeIcon>
          <Stack gap={0}>
            <Title order={3} c="var(--app-text-strong)">
              AI interview
            </Title>
            <Text c="var(--app-text)" fz="sm">
              Complete your interview readiness step.
            </Text>
          </Stack>
        </Group>

        {error && (
          <Alert icon={<AlertCircle size={16} />} color="red" radius="md">
            {error}
          </Alert>
        )}

        {!hasQuestion && !isFinished ? (
          <Card withBorder radius="md" p="md" bg="var(--app-active-bg)">
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Text fw={700} c="var(--app-text)">
                    Interview readiness
                  </Text>
                  <Text fz="sm" c="var(--app-text)">
                    Start your AI interview session using the data extracted
                    from your CV.
                  </Text>
                </Stack>
                <Badge color="cyan" variant="light">
                  {cvData ? "Ready" : "Waiting for CV"}
                </Badge>
              </Group>

              <Group gap="xs" wrap="wrap">
                <Badge
                  leftSection={<Sparkles size={12} />}
                  color="indigo"
                  variant="light"
                >
                  Adaptive questions
                </Badge>
                <Badge
                  leftSection={<ShieldCheck size={12} />}
                  color="teal"
                  variant="light"
                >
                  Anti-cheat checks
                </Badge>
              </Group>

              <Text fz="sm" c="var(--app-text)">
                The interview will use your skills, projects, and experience to
                generate questions that fit your background.
              </Text>

              <Button
                onClick={handleStart}
                loading={loading}
                disabled={!cvData}
              >
                Start AI interview
              </Button>
            </Stack>
          </Card>
        ) : null}

        {hasQuestion && currentQuestion ? (
          <Card withBorder radius="md" p="md" bg="var(--app-active-bg)">
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={2}>
                  <Text fw={700} c="var(--app-text)">
                    {currentQuestion.skill_name || "Interview question"}
                  </Text>
                  <Text fz="sm" c="var(--app-text)">
                    Question {currentQuestion.question_number ?? "-"}
                    {currentQuestion.total_questions
                      ? ` of ${currentQuestion.total_questions}`
                      : ""}
                  </Text>
                </Stack>
                {currentQuestion.is_followup ? (
                  <Badge color="blue" variant="light">
                    Follow-up {currentQuestion.followup_number}
                  </Badge>
                ) : (
                  <Badge color="cyan" variant="light">
                    Main question
                  </Badge>
                )}
              </Group>

              <Text fw={600} c="var(--app-text-strong)">
                {currentQuestion.question_text}
              </Text>

              <Textarea
                value={answer}
                onChange={(event) => setAnswer(event.currentTarget.value)}
                minRows={5}
                autosize
                label="Your answer"
                placeholder="Write your answer here"
                styles={{
                  label: { color: "var(--app-text)", fontWeight: 600 },
                }}
              />

              <Group justify="space-between">
                <Text fz="xs" c="dimmed">
                  Session: {sessionId}
                </Text>
                <Button
                  onClick={handleSubmit}
                  loading={submitting}
                  rightSection={<Send size={16} />}
                >
                  Submit answer
                </Button>
              </Group>
            </Stack>
          </Card>
        ) : null}

        {isFinished && report ? (
          <Card withBorder radius="md" p="md" bg="var(--app-active-bg)">
            <Stack gap="md">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text fw={700} c="var(--app-text)">
                    Interview complete
                  </Text>
                  <Text fz="sm" c="var(--app-text)">
                    Your session has been scored and verified.
                  </Text>
                </Stack>
                <Badge
                  color={report.is_verified ? "teal" : "red"}
                  variant="light"
                >
                  {report.is_verified ? "Verified" : "Not verified"}
                </Badge>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <Card withBorder radius="md" p="md">
                  <Text fz="xs" c="dimmed">
                    Overall score
                  </Text>
                  <Text fw={700} fz="xl" c="var(--app-text-strong)">
                    {report.overall_score}
                  </Text>
                </Card>
                <Card withBorder radius="md" p="md">
                  <Text fz="xs" c="dimmed">
                    Questions answered
                  </Text>
                  <Text fw={700} fz="xl" c="var(--app-text-strong)">
                    {report.total_questions}
                  </Text>
                </Card>
                <Card withBorder radius="md" p="md">
                  <Text fz="xs" c="dimmed">
                    Cheating detected
                  </Text>
                  <Text fw={700} fz="xl" c="var(--app-text-strong)">
                    {report.cheating_detected ? "Yes" : "No"}
                  </Text>
                </Card>
              </SimpleGrid>

              <Divider />

              <Stack gap="xs">
                <Text fw={700} c="var(--app-text)">
                  Skill breakdown
                </Text>
                <ScrollArea h={180}>
                  <Stack gap="xs">
                    {report.skill_scores.map((item) => (
                      <Card key={item.skill} withBorder radius="md" p="sm">
                        <Group justify="space-between">
                          <Text fw={600} c="var(--app-text)">
                            {item.skill}
                          </Text>
                          <Text fw={700} c="var(--app-text-strong)">
                            {item.score}
                          </Text>
                        </Group>
                        <Text fz="xs" c="dimmed">
                          {item.questions_asked} question
                          {item.questions_asked === 1 ? "" : "s"} scored
                        </Text>
                      </Card>
                    ))}
                  </Stack>
                </ScrollArea>
              </Stack>

              <Button
                onClick={() => router.push("/freelancer/dashboard")}
                loading={saving}
                variant="gradient"
                gradient={{ from: "teal", to: "cyan", deg: 110 }}
              >
                Continue to Dashboard
              </Button>
            </Stack>
          </Card>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Card withBorder radius="md" p="md">
            <Group mb={4}>
              <Briefcase size={16} />
              <Text fw={600} c="var(--app-text)">
                What this validates
              </Text>
            </Group>
            <List spacing={4} fz="sm" c="var(--app-text)">
              <List.Item>Communication clarity</List.Item>
              <List.Item>Problem solving approach</List.Item>
              <List.Item>Client collaboration style</List.Item>
            </List>
          </Card>

          <Card withBorder radius="md" p="md">
            <Text fw={600} c="var(--app-text)" mb={4}>
              Score snapshot
            </Text>
            <List spacing={4} fz="sm" c="var(--app-text)">
              <List.Item>Communication: 82/100</List.Item>
              <List.Item>Technical confidence: 76/100</List.Item>
              <List.Item>Client fit: 88/100</List.Item>
            </List>
          </Card>
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}
