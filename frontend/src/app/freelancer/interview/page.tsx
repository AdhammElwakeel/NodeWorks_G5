"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Title,
  Textarea,
  Progress,
  Badge,
  Alert,
  Loader,
  RingProgress,
  SimpleGrid,
  ThemeIcon,
  Divider,
  FileInput,
  Tooltip,
} from "@mantine/core";
import {
  Cpu,
  Play,
  Send,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  Trophy,
  Sparkles,
  FileText,
  Upload,
  Zap,
  XCircle,
  Languages,
  Gavel,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";
import { interviewApi, profileApi } from "@/lib/api";
import { notifications } from "@mantine/notifications";

// ── Types ───────────────────────────────────────────────────────────────────
interface CurrentQuestion {
  question_text: string;
  focus_concept: string;
  skill_name: string;
  is_followup: boolean;
  followup_number: number;
  question_number: number;
  total_questions: number;
}

interface SkillScore {
  skill: string;
  score: number;
  questions_asked: number;
}

interface Report {
  session_id: string;
  candidate_id?: string;
  overall_score: number;
  raw_score?: number;
  is_verified: boolean;
  skill_scores: SkillScore[];
  total_questions: number;
  cheating_detected: boolean;
  violations?: number;
  english_score?: number;
  penalty?: number;
  penalty_breakdown?: { violations: number; cheat_flags: number; total: number };
  strong_skills?: string[];
  badge_tier?: "gold" | "silver" | "bronze" | null;
}

const CV_ANALYSIS_URL =
  process.env.NEXT_PUBLIC_CV_ANALYSIS_API_URL ??
  "http://localhost:8010/api/analyze-cv";

const TIER_META: Record<
  "gold" | "silver" | "bronze",
  { label: string; color: string; icon: string }
> = {
  gold: { label: "Gold", color: "#f59e0b", icon: "🥇" },
  silver: { label: "Silver", color: "#94a3b8", icon: "🥈" },
  bronze: { label: "Bronze", color: "#b45309", icon: "🥉" },
};

export default function InterviewPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [phase, setPhase] = useState<"idle" | "active" | "done">("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  const [currentQ, setCurrentQ] = useState<CurrentQuestion | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalQ, setTotalQ] = useState(0);
  const [answer, setAnswer] = useState("");

  // Penalty / proctoring state
  const [violations, setViolations] = useState(0);
  const [violationMsg, setViolationMsg] = useState<string | null>(null);
  const pastedRef = useRef(false);

  // CV reupload state
  const [cvAnalyzing, setCvAnalyzing] = useState(false);
  const [cvData, setCvData] = useState<Record<string, unknown> | null>(null);

  // ── Tab switch detection → penalty ───────────────────────────────────────
  useEffect(() => {
    if (phase !== "active" || !sessionId) return;
    const handleVisibility = () => {
      if (document.hidden) {
        setViolations((v) => {
          const next = v + 1;
          setViolationMsg(`Tab switch detected — -5% penalty (${next} total)`);
          interviewApi
            .reportViolation({ sessionId, violationType: "tab_switch" })
            .catch(() => {});
          return next;
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase, sessionId]);

  // ── Paste prevention → penalty ───────────────────────────────────────────
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      pastedRef.current = true;
      setViolations((v) => {
        const next = v + 1;
        setViolationMsg(`Copy-paste blocked — -5% penalty (${next} total)`);
        if (sessionId)
          interviewApi
            .reportViolation({ sessionId, violationType: "paste_attempt" })
            .catch(() => {});
        return next;
      });
    },
    [sessionId],
  );

  // ── Start interview ──────────────────────────────────────────────────────
  const handleStart = async () => {
    setIsLoading(true);
    setViolations(0);
    setViolationMsg(null);
    try {
      const cvPayload = cvData ?? user?.freelancerProfile?.cvAnalysis ?? {};
      const data = await interviewApi.start({
        cvData: cvPayload as Record<string, unknown>,
        numSkills: 5,
      });
      const started = data as {
        session_id: string;
        total_questions: number;
        first_question: CurrentQuestion;
      };
      setSessionId(started.session_id);
      setTotalQ(started.total_questions);
      setCurrentQ(started.first_question);
      setAnsweredCount(0);
      setPhase("active");
    } catch (err: unknown) {
      setViolationMsg(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Submit answer (real or demo bypass) ──────────────────────────────────
  const submitAnswer = async (
    text: string,
    demoResult?: "right" | "wrong",
  ) => {
    if (!sessionId || isLoading) return;
    if (!demoResult && !text.trim()) return;
    const payload = demoResult ? "[demo bypass]" : text.trim();
    setAnswer("");
    pastedRef.current = false;
    setIsLoading(true);
    try {
      const data = await interviewApi.submitAnswer({
        sessionId,
        answer: payload,
        demoResult,
      });
      const result = data as {
        status: string;
        questions_answered: number;
        next_question: CurrentQuestion | null;
        report?: Report;
      };
      setAnsweredCount(result.questions_answered ?? answeredCount + 1);

      if (result.status === "completed" && result.report) {
        const completedReport: Report = {
          ...result.report,
          violations: (result.report.violations ?? 0) + violations,
        };
        setReport(completedReport);
        await interviewApi.saveResult({
          sessionId: completedReport.session_id,
          overallScore: completedReport.overall_score,
          rawScore: completedReport.raw_score,
          isVerified: completedReport.is_verified,
          totalQuestions: completedReport.total_questions,
          cheatingDetected: completedReport.cheating_detected,
          skillScores: completedReport.skill_scores.map((s) => ({
            skill: s.skill,
            score: s.score,
            questionsAsked: s.questions_asked,
          })),
          englishScore: completedReport.english_score,
          penalty: completedReport.penalty,
          penaltyBreakdown: completedReport.penalty_breakdown
            ? {
                violations: completedReport.penalty_breakdown.violations,
                cheatFlags: completedReport.penalty_breakdown.cheat_flags,
                total: completedReport.penalty_breakdown.total,
              }
            : undefined,
          strongSkills: completedReport.strong_skills,
          badgeTier: completedReport.badge_tier,
          violations: completedReport.violations,
        });
        await refreshUser();
        setPhase("done");
      } else {
        setCurrentQ(result.next_question ?? null);
      }
    } catch {
      setViolationMsg("Error submitting answer. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => submitAnswer(answer);
  const handleDemoRight = () => submitAnswer("", "right");
  const handleDemoWrong = () => submitAnswer("", "wrong");

  // ── Retake ───────────────────────────────────────────────────────────────
  const handleReset = () => {
    setPhase("idle");
    setSessionId(null);
    setCurrentQ(null);
    setAnsweredCount(0);
    setTotalQ(0);
    setAnswer("");
    setReport(null);
    setViolations(0);
    setViolationMsg(null);
  };

  // ── CV reupload (updates profile + feeds interview questions) ────────────
  const handleCVReUpload = async (file: File | null) => {
    if (!file) return;
    setCvAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(CV_ANALYSIS_URL, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { detail?: string }).detail ?? "CV analysis failed",
        );
      }
      const data = (await res.json()) as Record<string, unknown>;
      setCvData(data);
      await profileApi.update({
        profile: {
          cvAnalysis: data,
          skills:
            (data.all_skills as string[] | undefined)?.slice(0, 20) ?? undefined,
        },
      });
      await refreshUser();
      notifications.show({
        title: "CV updated",
        message: "Your profile has been refreshed with the new CV data.",
        color: "teal",
      });
    } catch (err: unknown) {
      notifications.show({
        title: "CV upload failed",
        message: err instanceof Error ? err.message : "Please try again.",
        color: "red",
      });
    } finally {
      setCvAnalyzing(false);
    }
  };

  const skillIndex = currentQ
    ? Math.floor((currentQ.question_number - 1) / 4) + 1
    : 0;

  return (
    <ProtectedRoute requiredRole="freelancer">
      <Box
        style={{
          minHeight: "100vh",
          backgroundColor: "#f8fafc",
          padding: "32px 24px",
        }}
      >
        <Box maw={820} mx="auto">
          {/* Back button */}
          <Group mb="lg">
            <Button
              component={Link}
              href="/freelancer/dashboard"
              variant="subtle"
              leftSection={<ArrowLeft size={16} />}
              size="sm"
            >
              Back to dashboard
            </Button>
          </Group>

          {violationMsg && (
            <Box
              style={{
                position: "fixed",
                top: 20,
                right: 20,
                zIndex: 9999,
                background: "#ef4444",
                color: "#fff",
                padding: "10px 16px",
                borderRadius: 10,
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
              }}
            >
              <AlertTriangle size={16} />
              {violationMsg}
            </Box>
          )}

          <Card withBorder radius="md" p="xl" bg="white">
            <Stack gap="lg">
              {/* Header */}
              <Group>
                <ThemeIcon size={46} radius="md" color="cyan" variant="light">
                  <Cpu size={24} />
                </ThemeIcon>
                <Stack gap={0} style={{ flex: 1 }}>
                  <Title order={3} c="dark.9">
                    AI Technical Interview
                  </Title>
                  <Text c="dimmed" fz="sm">
                    {phase === "idle" &&
                      "5 skills from your CV · 1 main + 3 follow-ups each · demo bypass available"}
                    {phase === "active" &&
                      currentQ &&
                      `Skill ${skillIndex}/5 — ${currentQ.skill_name}`}
                    {phase === "done" && "Interview complete — review your badge"}
                  </Text>
                </Stack>
                {phase === "active" && violations > 0 && (
                  <Badge color="red" variant="light" leftSection={<Gavel size={12} />}>
                    {violations} penalty{violations > 1 ? "s" : ""}
                  </Badge>
                )}
              </Group>

              {/* ── IDLE ── */}
              {phase === "idle" && (
                <Stack gap="md">
                  <Card withBorder radius="md" p="md" bg="cyan.0">
                    <Stack gap="sm">
                      <Text fw={600} c="dark.9">
                        What to expect
                      </Text>
                      <SimpleGrid cols={2} spacing="xs">
                        {[
                          ["🎯", "5 skills from your CV"],
                          ["❓", "1 main + 3 follow-up per skill"],
                          ["📹", "Tab-switch + paste monitoring"],
                          ["⚡", "Demo bypass buttons for testing"],
                          ["🇬🇧", "English quality scoring"],
                          ["🏆", "Verified badge on your profile"],
                        ].map(([icon, label]) => (
                          <Group key={label} gap="xs">
                            <Text fz="md">{icon}</Text>
                            <Text fz="sm" c="dark.8">
                              {label}
                            </Text>
                          </Group>
                        ))}
                      </SimpleGrid>
                    </Stack>
                  </Card>

                  {/* CV reupload before starting */}
                  <Card withBorder radius="md" p="md">
                    <Group gap="xs" mb="xs">
                      <Upload size={16} color="#4f46e5" />
                      <Text fw={600} c="dark.9" fz="sm">
                        Re-upload CV (optional)
                      </Text>
                    </Group>
                    <Text fz="xs" c="dimmed" mb="sm">
                      Upload a fresh CV to update your profile and personalise the
                      interview questions.
                    </Text>
                    <FileInput
                      placeholder="Choose a PDF to refresh your skills"
                      accept=".pdf"
                      onChange={handleCVReUpload}
                      leftSection={<FileText size={16} />}
                      disabled={cvAnalyzing}
                    />
                    {cvAnalyzing && (
                      <Group gap="xs" mt="sm">
                        <Loader size="xs" />
                        <Text fz="xs" c="dimmed">
                          Analyzing CV…
                        </Text>
                      </Group>
                    )}
                    {cvData && (
                      <Text fz="xs" c="teal.7" mt="sm">
                        ✓ CV loaded —{" "}
                        {(cvData.all_skills as string[] | undefined)?.length ?? 0}{" "}
                        skills detected
                      </Text>
                    )}
                  </Card>

                  <Button
                    onClick={handleStart}
                    loading={isLoading}
                    leftSection={<Play size={16} />}
                    variant="gradient"
                    gradient={{ from: "cyan", to: "indigo", deg: 135 }}
                    size="lg"
                    fullWidth
                  >
                    Start Test
                  </Button>
                </Stack>
              )}

              {/* ── ACTIVE ── */}
              {phase === "active" && currentQ && (
                <Stack gap="md">
                  <Box>
                    <Group justify="space-between" mb={4}>
                      <Text fz="xs" c="dimmed">
                        Questions answered
                      </Text>
                      <Text fz="xs" c="dimmed">
                        {answeredCount} / {totalQ}
                      </Text>
                    </Group>
                    <Progress
                      value={totalQ > 0 ? (answeredCount / totalQ) * 100 : 0}
                      color="cyan"
                      radius="xl"
                      size="sm"
                      animated
                    />
                  </Box>

                  {/* Question card */}
                  <Card withBorder radius="md" p="md" bg="indigo.0">
                    <Group gap="xs">
                      <Badge color="indigo" variant="filled" size="sm">
                        Skill {skillIndex}/5
                      </Badge>
                      <Badge color="indigo" variant="light" size="sm">
                        {currentQ.skill_name}
                      </Badge>
                      {currentQ.is_followup ? (
                        <Badge color="violet" variant="light" size="sm">
                          Follow-up {currentQ.followup_number}/3
                        </Badge>
                      ) : (
                        <Badge color="cyan" variant="light" size="sm">
                          Main question
                        </Badge>
                      )}
                    </Group>
                  </Card>

                  <Text
                    fz="md"
                    c="dark.8"
                    style={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }}
                  >
                    {currentQ.question_text}
                  </Text>

                  <Group gap="xs">
                    <Text fz="xs" c="dimmed">
                      Focus:
                    </Text>
                    <Badge color="gray" variant="light" size="xs">
                      {currentQ.focus_concept}
                    </Badge>
                  </Group>

                  <Divider />

                  <Textarea
                    placeholder="Type your answer here… (Ctrl+Enter to submit)"
                    value={answer}
                    onChange={(e) => setAnswer(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.ctrlKey) handleSubmit();
                    }}
                    onPaste={handlePaste}
                    minRows={4}
                    maxRows={8}
                    disabled={isLoading}
                    styles={{ input: { fontSize: 14 } }}
                  />

                  <Group justify="space-between" align="center">
                    <Group gap="xs">
                      <Text fz="xs" c="dimmed">
                        Ctrl+Enter to send
                      </Text>
                      {violations > 0 && (
                        <Badge size="xs" color="red" variant="light">
                          {violations} violation{violations > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </Group>
                    <Button
                      onClick={handleSubmit}
                      disabled={!answer.trim() || isLoading}
                      loading={isLoading}
                      leftSection={<Send size={16} />}
                      variant="gradient"
                      gradient={{ from: "indigo", to: "cyan", deg: 135 }}
                    >
                      {isLoading ? "Grading…" : "Submit Answer"}
                    </Button>
                  </Group>

                  {/* Demo bypass buttons */}
                  <Card withBorder radius="md" p="sm" bg="gray.0">
                    <Group gap="xs" mb="xs">
                      <Zap size={14} color="#f59e0b" />
                      <Text fw={600} fz="xs" c="dark.8">
                        Demo bypass — skip the LLM grading
                      </Text>
                    </Group>
                    <Group gap="sm">
                      <Tooltip label="Marks this answer as fully correct (score 10)">
                        <Button
                          size="sm"
                          color="teal"
                          variant="light"
                          leftSection={<CheckCircle size={14} />}
                          onClick={handleDemoRight}
                          loading={isLoading}
                        >
                          Mark Right
                        </Button>
                      </Tooltip>
                      <Tooltip label="Marks this answer as incorrect (score 2)">
                        <Button
                          size="sm"
                          color="red"
                          variant="light"
                          leftSection={<XCircle size={14} />}
                          onClick={handleDemoWrong}
                          loading={isLoading}
                        >
                          Mark Wrong
                        </Button>
                      </Tooltip>
                    </Group>
                  </Card>
                </Stack>
              )}

              {/* ── DONE / RESULTS + BADGE ── */}
              {phase === "done" && report && (
                <InterviewBadge report={report} onReset={handleReset} onGoToProfile={() => router.push("/freelancer/profile")} />
              )}
            </Stack>
          </Card>
        </Box>
      </Box>
    </ProtectedRoute>
  );
}

// ── Badge / Results card ──────────────────────────────────────────────────────

function InterviewBadge({
  report,
  onReset,
  onGoToProfile,
}: {
  report: Report;
  onReset: () => void;
  onGoToProfile: () => void;
}) {
  const tier = report.badge_tier ?? null;
  const tierMeta = tier ? TIER_META[tier] : null;
  const isPassing = report.overall_score >= 65;

  return (
    <Stack gap="md" align="center">
      {/* Badge medallion */}
      <Box
        style={{
          width: 130,
          height: 130,
          borderRadius: "50%",
          background: tierMeta
            ? `linear-gradient(135deg, ${tierMeta.color}, ${tierMeta.color}cc)`
            : "linear-gradient(135deg, #94a3b8, #64748b)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          flexDirection: "column",
          color: "#fff",
        }}
      >
        <Trophy size={40} />
        <Text fw={800} fz="xs" ta="center" mt={4}>
          {tierMeta ? `${tierMeta.icon} ${tierMeta.label}` : "No Badge"}
        </Text>
      </Box>

      <Group gap="xs">
        <Title order={4} c="dark.9">
          {report.is_verified ? "Verified!" : "Not Verified"}
        </Title>
        {report.is_verified ? (
          <ShieldCheck size={20} color="#10b981" />
        ) : (
          <ShieldOff size={20} color="#ef4444" />
        )}
      </Group>

      {/* Overall score ring */}
      <RingProgress
        size={120}
        thickness={10}
        sections={[{ value: report.overall_score, color: isPassing ? "teal" : "red" }]}
        label={
          <Text ta="center" fw={800} fz="xl" c={isPassing ? "teal.6" : "red.6"}>
            {report.overall_score}%
          </Text>
        }
      />

      {/* Score grid: technical / english / penalty */}
      <SimpleGrid cols={3} spacing="sm" w="100%">
        <ScoreStat
          icon={<Cpu size={16} />}
          label="Technical"
          value={`${report.raw_score ?? report.overall_score}%`}
          color="#4f46e5"
        />
        <ScoreStat
          icon={<Languages size={16} />}
          label="English"
          value={`${report.english_score ?? 0}%`}
          color="#06b6d4"
        />
        <ScoreStat
          icon={<Gavel size={16} />}
          label="Penalty"
          value={`-${report.penalty ?? 0}%`}
          color="#ef4444"
        />
      </SimpleGrid>

      {/* Penalty breakdown */}
      {(report.penalty ?? 0) > 0 && report.penalty_breakdown && (
        <Alert icon={<AlertTriangle size={16} />} color="orange" radius="md" w="100%">
          Penalty applied: {report.penalty_breakdown.violations}% from{" "}
          {report.violations ?? 0} violation(s) +{" "}
          {report.penalty_breakdown.cheat_flags}% from cheating flags (capped at
          30%).
        </Alert>
      )}

      {report.cheating_detected && (
        <Alert icon={<AlertTriangle size={16} />} color="red" radius="md" w="100%">
          Suspicious activity was detected during your interview.
        </Alert>
      )}

      <Divider w="100%" />

      {/* Skill scores */}
      <Stack gap="xs" w="100%">
        <Text fw={600} c="dark.9" fz="sm">
          Skill breakdown
        </Text>
        {report.skill_scores.map((s) => {
          const verified = s.score >= 65;
          return (
            <Box key={s.skill}>
              <Group justify="space-between" mb={4}>
                <Group gap="xs">
                  <Text fz="sm" fw={500} c="dark.7">
                    {s.skill}
                  </Text>
                  {verified ? (
                    <Badge size="xs" color="teal" variant="light" leftSection={<CheckCircle size={10} />}>
                      Strong
                    </Badge>
                  ) : (
                    <Badge size="xs" color="gray" variant="light">
                      Needs work
                    </Badge>
                  )}
                </Group>
                <Text fz="sm" c="dimmed">
                  {s.score}%
                </Text>
              </Group>
              <Progress
                value={s.score}
                color={s.score >= 65 ? "teal" : s.score >= 45 ? "yellow" : "red"}
                radius="xl"
                size="sm"
              />
            </Box>
          );
        })}
      </Stack>

      {/* Strong skills summary */}
      {report.strong_skills && report.strong_skills.length > 0 && (
        <Stack gap="xs" w="100%">
          <Group gap="xs">
            <Sparkles size={16} color="#10b981" />
            <Text fw={600} c="dark.9" fz="sm">
              Skills you&apos;re strong at
            </Text>
          </Group>
          <Group gap="xs">
            {report.strong_skills.map((skill) => (
              <Badge key={skill} color="teal" variant="light" size="md">
                {skill}
              </Badge>
            ))}
          </Group>
        </Stack>
      )}

      <Divider w="100%" />

      {/* Actions: retake + view profile */}
      <Group gap="sm" w="100%">
        <Button
          variant="light"
          leftSection={<RefreshCw size={16} />}
          onClick={onReset}
          style={{ flex: 1 }}
        >
          Retake Interview
        </Button>
        <Button
          variant="gradient"
          gradient={{ from: "indigo", to: "cyan", deg: 135 }}
          leftSection={<ShieldCheck size={16} />}
          onClick={onGoToProfile}
          style={{ flex: 1 }}
        >
          View Badge on Profile
        </Button>
      </Group>
    </Stack>
  );
}

function ScoreStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card withBorder radius="md" p="sm" ta="center">
      <Stack gap={2} align="center">
        <Box style={{ color }}>{icon}</Box>
        <Text fw={700} fz="lg" c="dark.9">
          {value}
        </Text>
        <Text fz="xs" c="dimmed">
          {label}
        </Text>
      </Stack>
    </Card>
  );
}
