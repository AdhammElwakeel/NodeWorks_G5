"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Paper,
  Stack,
  Group,
  Text,
  Title,
  ThemeIcon,
  Button,
  Box,
  Badge,
  Loader,
  Textarea,
  Progress,
  Card,
  Alert,
  Divider,
  ScrollArea,
  RingProgress,
  SimpleGrid,
} from "@mantine/core";
import {
  Cpu,
  Play,
  Send,
  VideoOff,
  AlertTriangle,
  CheckCircle,
  BarChart2,
  RefreshCw,
  Eye,
  Shield,
  ShieldOff,
  Copy,
} from "lucide-react";

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
  overall_score: number;
  is_verified: boolean;
  skill_scores: SkillScore[];
  cheating_detected: boolean;
  violations?: number;
}

// ── API ───────────────────────────────────────────────────────────────────────

const interviewApi = {
  start: async (cvData: Record<string, unknown>) => {
    const res = await fetch("/api/interview/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cv_data: cvData, num_skills: 5 }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { detail?: string }).detail ?? "Failed to start interview",
      );
    }
    return res.json();
  },
  submitAnswer: async (sessionId: string, answer: string) => {
    const res = await fetch("/api/interview/submit-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, answer }),
    });
    if (!res.ok) throw new Error("Failed to submit answer");
    return res.json();
  },
  reportViolation: async (sessionId: string, type: string) => {
    await fetch("/api/interview/report-violation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, violation_type: type }),
    }).catch(() => {});
  },
};

// ── Webcam + Gaze Monitor ────────────────────────────────────────────────────

interface WebcamStatus {
  status: "safe" | "warning" | "cheating";
  lookAways: number;
  debugInfo: string;
}

function WebcamMonitor({
  isActive,
  onStatusChange,
}: {
  isActive: boolean;
  onStatusChange?: (s: WebcamStatus) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraOk, setCameraOk] = useState(false);
  const [cameraErr, setCameraErr] = useState(false);
  const [gazeStatus, setGazeStatus] = useState<"safe" | "warning" | "cheating">(
    "safe",
  );
  const [lookAways, setLookAways] = useState(0);
  const [debugInfo, setDebugInfo] = useState("Initialising…");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveNoFaceRef = useRef(0);
  const consecutiveLookAwayRef = useRef(0);
  const faceApiRef = useRef<typeof import("face-api.js") | null>(null);
  const modelsLoadedRef = useRef(false);

  // Load face-api and models lazily
  useEffect(() => {
    if (!isActive) return;
    let mounted = true;

    const load = async () => {
      try {
        setDebugInfo("Loading models…");
        const faceapi = await import("face-api.js");
        faceApiRef.current = faceapi;
        const MODEL_URL =
          "https://justadudewhohacks.github.io/face-api.js/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        ]);
        if (mounted) {
          modelsLoadedRef.current = true;
          setDebugInfo("Ready");
        }
      } catch {
        if (mounted) setDebugInfo("Gaze model failed");
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [isActive]);

  // Camera stream
  useEffect(() => {
    if (!isActive) return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } } })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadeddata = () => setCameraOk(true);
        }
      })
      .catch(() => setCameraErr(true));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [isActive]);

  // Gaze detection loop
  useEffect(() => {
    if (!isActive || !cameraOk || !modelsLoadedRef.current) return;
    const faceapi = faceApiRef.current;
    if (!faceapi) return;

    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const det = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 224,
              scoreThreshold: 0.5,
            }),
          )
          .withFaceLandmarks(true);

        if (!det) {
          consecutiveNoFaceRef.current++;
          consecutiveLookAwayRef.current = 0;
          setDebugInfo(`No face (${consecutiveNoFaceRef.current})`);
          if (consecutiveNoFaceRef.current > 5) setGazeStatus("warning");
          if (consecutiveNoFaceRef.current > 10) {
            setGazeStatus("cheating");
            setLookAways((p) => p + 1);
            consecutiveNoFaceRef.current = 0;
          }
          return;
        }
        consecutiveNoFaceRef.current = 0;

        const leftEye = det.landmarks.getLeftEye();
        const rightEye = det.landmarks.getRightEye();
        const nose = det.landmarks.getNose();
        const lc = {
          x: leftEye.reduce((s, p) => s + p.x, 0) / leftEye.length,
          y: 0,
        };
        const rc = {
          x: rightEye.reduce((s, p) => s + p.x, 0) / rightEye.length,
          y: 0,
        };
        const noseTip = nose[3];
        const faceCenter = { x: (lc.x + rc.x) / 2 };
        const eyeDist = Math.abs(rc.x - lc.x);
        const offset = Math.abs((noseTip.x - faceCenter.x) / eyeDist);
        setDebugInfo(`Gaze: ${offset.toFixed(2)}`);

        if (offset > 0.25) {
          consecutiveLookAwayRef.current++;
          if (consecutiveLookAwayRef.current > 3) setGazeStatus("warning");
          if (consecutiveLookAwayRef.current > 8) {
            setGazeStatus("cheating");
            setLookAways((p) => p + 1);
            consecutiveLookAwayRef.current = 0;
          }
        } else {
          consecutiveLookAwayRef.current = 0;
          setGazeStatus("safe");
        }
      } catch {
        /* silent */
      }
    };

    intervalRef.current = setInterval(detect, 200);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, cameraOk]);

  // Notify parent
  useEffect(() => {
    onStatusChange?.({ status: gazeStatus, lookAways, debugInfo });
  }, [gazeStatus, lookAways, debugInfo, onStatusChange]);

  const borderColor =
    gazeStatus === "cheating"
      ? "#ef4444"
      : gazeStatus === "warning"
        ? "#f59e0b"
        : "#22c55e";

  return (
    <Box
      style={{
        position: "relative",
        width: 150,
        height: 108,
        borderRadius: 10,
        overflow: "hidden",
        border: `${gazeStatus === "cheating" ? 3 : 2}px solid ${borderColor}`,
        background: "#0f172a",
        flexShrink: 0,
        transition: "border-color 0.2s",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
          display: cameraOk ? "block" : "none",
        }}
      />
      {!cameraOk && !cameraErr && (
        <Box
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Loader size="xs" color="gray" />
        </Box>
      )}
      {cameraErr && (
        <Box
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <VideoOff size={20} color="#ef4444" />
        </Box>
      )}

      {/* Status dot */}
      <Box
        style={{
          position: "absolute",
          bottom: 4,
          right: 4,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: borderColor,
        }}
      />

      {/* Debug */}
      <Box
        style={{
          position: "absolute",
          bottom: 2,
          left: 2,
          background: "rgba(0,0,0,0.7)",
          color: borderColor,
          fontSize: 7,
          padding: "1px 3px",
          borderRadius: 2,
          fontFamily: "monospace",
        }}
      >
        {debugInfo}
      </Box>

      {/* Look-away counter */}
      {lookAways > 0 && (
        <Box
          style={{
            position: "absolute",
            top: 3,
            left: 3,
            background: "#ef4444",
            color: "#fff",
            fontSize: 9,
            padding: "1px 5px",
            borderRadius: 3,
            fontWeight: "bold",
          }}
        >
          ⚠ {lookAways}
        </Box>
      )}

      {/* LOOK HERE overlay */}
      {gazeStatus === "cheating" && (
        <Box
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(239,68,68,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            color: "#fff",
            fontWeight: "bold",
          }}
        >
          👁 LOOK HERE
        </Box>
      )}
    </Box>
  );
}

// ── Warning toast ─────────────────────────────────────────────────────────────

function ViolationToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
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
        animation: "slideIn 0.3s ease",
      }}
    >
      <AlertTriangle size={16} />
      {message}
    </Box>
  );
}

// ── Report Card ───────────────────────────────────────────────────────────────

function ReportCard({
  report,
  onReset,
}: {
  report: Report;
  onReset: () => void;
}) {
  const isPassing = report.overall_score >= 65;
  return (
    <Card withBorder radius="md" p="lg" bg="white">
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <BarChart2 size={20} color="#4f46e5" />
            <Text fw={700} fz="lg" c="dark.9">
              Interview Results
            </Text>
          </Group>
          <Badge
            color={report.is_verified ? "teal" : "red"}
            variant="light"
            size="lg"
            leftSection={
              report.is_verified ? (
                <CheckCircle size={12} />
              ) : (
                <ShieldOff size={12} />
              )
            }
          >
            {report.is_verified ? "Verified" : "Not Verified"}
          </Badge>
        </Group>

        {/* Overall */}
        <Group justify="center">
          <RingProgress
            size={120}
            thickness={10}
            sections={[
              {
                value: report.overall_score,
                color: isPassing ? "teal" : "red",
              },
            ]}
            label={
              <Text
                ta="center"
                fw={800}
                fz="xl"
                c={isPassing ? "teal.6" : "red.6"}
              >
                {report.overall_score}%
              </Text>
            }
          />
        </Group>

        {/* Skill bars with verified badge */}
        <Stack gap="xs">
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
                      <Badge
                        size="xs"
                        color="teal"
                        variant="light"
                        leftSection={<CheckCircle size={10} />}
                      >
                        Verified
                      </Badge>
                    ) : (
                      <Badge
                        size="xs"
                        color="gray"
                        variant="light"
                        leftSection={<ShieldOff size={10} />}
                      >
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
                  color={
                    s.score >= 65 ? "teal" : s.score >= 45 ? "yellow" : "red"
                  }
                  radius="xl"
                  size="sm"
                />
              </Box>
            );
          })}
        </Stack>

        {report.cheating_detected && (
          <Alert icon={<AlertTriangle size={16} />} color="orange" radius="md">
            ⚠️ Suspicious activity was detected during your interview.
          </Alert>
        )}
        {(report.violations ?? 0) > 0 && (
          <Text fz="xs" c="dimmed" ta="center">
            Tab switches / paste attempts: {report.violations}
          </Text>
        )}

        <Button
          variant="light"
          leftSection={<RefreshCw size={16} />}
          onClick={onReset}
          fullWidth
        >
          Retake Interview
        </Button>
      </Stack>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface AIInterviewStepProps {
  cvData?: Record<string, unknown> | null;
}

export function AIInterviewStep({ cvData }: AIInterviewStepProps) {
  const [phase, setPhase] = useState<"idle" | "active" | "done">("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  // Question state — one topic at a time
  const [currentQ, setCurrentQ] = useState<CurrentQuestion | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalQ, setTotalQ] = useState(0);

  // Answer textarea
  const [answer, setAnswer] = useState("");

  // Anti-cheat state
  const [violations, setViolations] = useState(0);
  const [violationMsg, setViolationMsg] = useState<string | null>(null);
  const [gazeStatus, setGazeStatus] = useState<"safe" | "warning" | "cheating">(
    "safe",
  );
  const [lookAways, setLookAways] = useState(0);

  // Track if paste was used in this answer
  const pastedRef = useRef(false);

  // ── Tab switch detection ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "active" || !sessionId) return;
    const handleVisibility = () => {
      if (document.hidden) {
        const next = violations + 1;
        setViolations(next);
        setViolationMsg(`⚠ Tab switch detected! (${next} total)`);
        interviewApi.reportViolation(sessionId, "tab_switch");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase, sessionId, violations]);

  // ── Paste prevention ────────────────────────────────────────────────────────
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      pastedRef.current = true;
      const next = violations + 1;
      setViolations(next);
      setViolationMsg(`⚠ Copy-paste blocked! (${next} total)`);
      if (sessionId) interviewApi.reportViolation(sessionId, "paste_attempt");
    },
    [sessionId, violations],
  );

  // ── Gaze tracking callback ──────────────────────────────────────────────────
  const handleGazeStatus = useCallback(
    (s: WebcamStatus) => {
      setGazeStatus(s.status);
      setLookAways(s.lookAways);
      if (s.status === "cheating" && sessionId) {
        interviewApi.reportViolation(sessionId, "iris_look_away");
      }
    },
    [sessionId],
  );

  // ── Start ───────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    setIsLoading(true);
    try {
      const data = await interviewApi.start(cvData ?? {});
      setSessionId(data.session_id);
      setTotalQ(data.total_questions);
      setCurrentQ(data.first_question);
      setAnsweredCount(0);
      setPhase("active");
    } catch (err: unknown) {
      setViolationMsg(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!sessionId || !answer.trim() || isLoading) return;
    const text = answer.trim();
    setAnswer("");
    pastedRef.current = false;
    setIsLoading(true);
    try {
      const data = await interviewApi.submitAnswer(sessionId, text);
      setAnsweredCount(data.questions_answered ?? answeredCount + 1);

      if (data.status === "completed") {
        setReport({ ...data.report, violations: violations + lookAways });
        setPhase("done");
      } else {
        setCurrentQ(data.next_question ?? null);
      }
    } catch {
      setViolationMsg("Error submitting answer. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) handleSubmit();
  };

  const handleReset = () => {
    setPhase("idle");
    setSessionId(null);
    setCurrentQ(null);
    setAnsweredCount(0);
    setTotalQ(0);
    setAnswer("");
    setReport(null);
    setViolations(0);
    setLookAways(0);
    setGazeStatus("safe");
    setViolationMsg(null);
  };

  // Progress within the current topic (0 = main, 1-3 = follow-ups)
  const topicIndex = currentQ ? currentQ.question_number - 1 : 0;
  const skillIndex = currentQ ? Math.floor(topicIndex / 4) + 1 : 0;

  const gazeColor =
    gazeStatus === "cheating"
      ? "red"
      : gazeStatus === "warning"
        ? "yellow"
        : "teal";

  return (
    <Paper withBorder radius="md" p="lg" bg="white">
      {/* Violation toast */}
      {violationMsg && (
        <ViolationToast
          message={violationMsg}
          onDismiss={() => setViolationMsg(null)}
        />
      )}

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
                "5 skills · 1 main question + 3 follow-ups each · Medium difficulty"}
              {phase === "active" &&
                currentQ &&
                `Topic ${skillIndex}/5 — ${currentQ.skill_name}`}
              {phase === "done" && "Interview complete!"}
            </Text>
          </Stack>
          {phase === "active" && (
            <Group gap={6}>
              <Badge
                color={gazeColor}
                variant="light"
                leftSection={<Eye size={12} />}
              >
                {gazeStatus === "safe"
                  ? "Focused"
                  : gazeStatus === "warning"
                    ? "Look here"
                    : "Look here!"}
              </Badge>
              {violations > 0 && (
                <Badge
                  color="red"
                  variant="light"
                  leftSection={<Shield size={12} />}
                >
                  {violations} violation{violations > 1 ? "s" : ""}
                </Badge>
              )}
            </Group>
          )}
        </Group>

        {/* ── IDLE ── */}
        {phase === "idle" && (
          <Card withBorder radius="md" p="md" bg="cyan.0">
            <Stack gap="sm">
              <Text fw={600} c="dark.9">
                What to expect
              </Text>
              <SimpleGrid cols={2} spacing="xs">
                {[
                  ["🎯", "5 skills from your CV"],
                  ["❓", "1 main + 3 follow-up per skill"],
                  ["📊", "Medium difficulty questions"],
                  ["📹", "Camera proctoring active"],
                  ["🔒", "Tab switching monitored"],
                  ["🚫", "Copy-paste blocked"],
                ].map(([icon, label]) => (
                  <Group key={label} gap="xs">
                    <Text fz="md">{icon}</Text>
                    <Text fz="sm" c="dark.8">
                      {label}
                    </Text>
                  </Group>
                ))}
              </SimpleGrid>
              {!cvData && (
                <Alert
                  icon={<AlertTriangle size={14} />}
                  color="orange"
                  radius="md"
                >
                  No CV data — complete Step 1 first for personalised questions.
                </Alert>
              )}
              <Button
                onClick={handleStart}
                loading={isLoading}
                leftSection={<Play size={16} />}
                variant="gradient"
                gradient={{ from: "cyan", to: "indigo", deg: 135 }}
                mt="xs"
              >
                Start AI Interview
              </Button>
            </Stack>
          </Card>
        )}

        {/* ── ACTIVE ── */}
        {phase === "active" && currentQ && (
          <Stack gap="md">
            {/* Overall progress */}
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

            {/* Webcam + Question */}
            <Group align="flex-start" wrap="nowrap" gap="md">
              {/* Webcam column */}
              <Stack gap="xs" style={{ flexShrink: 0 }}>
                <WebcamMonitor isActive onStatusChange={handleGazeStatus} />
                {lookAways > 0 && (
                  <Badge
                    color="red"
                    variant="filled"
                    size="xs"
                    style={{ textAlign: "center" }}
                  >
                    👁 {lookAways} look-away{lookAways > 1 ? "s" : ""}
                  </Badge>
                )}
              </Stack>

              {/* Question card */}
              <Box style={{ flex: 1 }}>
                {/* Topic/skill header */}
                <Card withBorder radius="md" p="sm" bg="indigo.0" mb="sm">
                  <Group gap="xs">
                    <Badge color="indigo" variant="filled" size="sm">
                      Skill {skillIndex}/5
                    </Badge>
                    <Badge color="indigo" variant="light" size="sm">
                      {currentQ.skill_name}
                    </Badge>
                    {currentQ.is_followup && (
                      <Badge color="violet" variant="light" size="sm">
                        Follow-up {currentQ.followup_number}/3
                      </Badge>
                    )}
                    {!currentQ.is_followup && (
                      <Badge color="cyan" variant="light" size="sm">
                        Main question
                      </Badge>
                    )}
                  </Group>
                </Card>

                {/* Question text in scroll area */}
                <ScrollArea h={140} type="hover" scrollbarSize={4}>
                  <Text
                    fz="sm"
                    c="dark.8"
                    style={{ lineHeight: 1.7, whiteSpace: "pre-wrap" }}
                  >
                    {currentQ.question_text}
                  </Text>
                </ScrollArea>
              </Box>
            </Group>

            {/* Focus concept */}
            <Group gap="xs">
              <Text fz="xs" c="dimmed">
                Focus:
              </Text>
              <Badge color="gray" variant="light" size="xs">
                {currentQ.focus_concept}
              </Badge>
            </Group>

            <Divider />

            {/* Answer input */}
            <Textarea
              placeholder="Type your answer here… (Ctrl+Enter to submit)"
              value={answer}
              onChange={(e) => setAnswer(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
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
                  <Badge
                    size="xs"
                    color="red"
                    variant="light"
                    leftSection={<Copy size={10} />}
                  >
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
          </Stack>
        )}

        {/* ── DONE ── */}
        {phase === "done" && report && (
          <ReportCard report={report} onReset={handleReset} />
        )}
      </Stack>
    </Paper>
  );
}
