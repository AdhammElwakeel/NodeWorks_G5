"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  List,
  Paper,
  Progress,
  RingProgress,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  AlertCircle,
  BrainCircuit,
  Camera,
  CheckCircle,
  Eye,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { interviewApi, type InterviewQuestionData, type InterviewReportData } from "@/lib/api";
import { type CvData } from "./CVUploadStep";
import { type ProfileData } from "./ProfileStep";

const fieldLabelStyles = {
  label: { color: "var(--app-text)", fontWeight: 600 },
  required: { color: "var(--app-text)" },
  input: { color: "var(--app-text)" },
};

interface AIInterviewStepProps {
  cvData: CvData | null;
  profileData: ProfileData;
  report: InterviewReportData | null;
  onComplete: (report: InterviewReportData) => void;
  allowSkip?: boolean;
}

type CameraStatus = "idle" | "starting" | "active" | "blocked" | "stopped";

type TinyFaceDetectorOptionsConstructor = new (options: {
  inputSize: number;
  scoreThreshold: number;
}) => unknown;

type FaceApiModule = {
  nets: {
    tinyFaceDetector: { loadFromUri: (url: string) => Promise<unknown> };
    faceLandmark68TinyNet: { loadFromUri: (url: string) => Promise<unknown> };
  };
  TinyFaceDetectorOptions: TinyFaceDetectorOptionsConstructor;
  detectAllFaces: (
    input: HTMLVideoElement,
    options: unknown,
  ) => {
    withFaceLandmarks: (useTinyModel?: boolean) => Promise<unknown[]>;
  };
};

type LandmarkPoint = {
  x: number;
  y: number;
};

type FaceApiLandmarks = {
  getLeftEye: () => LandmarkPoint[];
  getRightEye: () => LandmarkPoint[];
  getNose: () => LandmarkPoint[];
  getMouth: () => LandmarkPoint[];
};

type FaceApiDetection = {
  landmarks: FaceApiLandmarks;
};

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

const VIOLATION_REASONS: Record<string, string> = {
  camera_stopped: "Camera stopped during the interview.",
  camera_muted: "Camera feed was muted or interrupted.",
  camera_no_frame: "Camera frame was not available.",
  camera_dark_or_covered: "Camera frame was too dark or covered.",
  camera_static_frame: "Camera frame appeared frozen or static.",
  no_face_detected: "No face was detected in the camera frame.",
  multiple_faces_detected: "Multiple faces were detected in the camera frame.",
  tab_switch: "Candidate switched away from the interview tab.",
  window_blur: "Interview window lost focus.",
  paste_attempt: "Candidate attempted to paste content.",
  copy_attempt: "Candidate attempted to copy content.",
  cut_attempt: "Candidate attempted to cut content.",
  context_menu_attempt: "Candidate opened the context menu.",
  fullscreen_exit: "Candidate exited fullscreen mode.",
  fullscreen_denied: "Candidate denied fullscreen mode.",
  look_away: "Candidate looked away from the screen.",
  gaze_shift: "Candidate gaze shifted away from the interview area.",
  eyes_closed: "Candidate eyes were closed or not visible.",
};

function distance(a: LandmarkPoint, b: LandmarkPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function center(points: LandmarkPoint[]) {
  const total = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );

  return { x: total.x / points.length, y: total.y / points.length };
}

function eyeAspectRatio(eye: LandmarkPoint[]) {
  if (eye.length < 6) return 1;

  const vertical = distance(eye[1], eye[5]) + distance(eye[2], eye[4]);
  const horizontal = distance(eye[0], eye[3]);

  return horizontal > 0 ? vertical / (2 * horizontal) : 1;
}

function getLandmarkViolation(landmarks: FaceApiLandmarks) {
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const nose = landmarks.getNose();
  const mouth = landmarks.getMouth();

  if (leftEye.length < 6 || rightEye.length < 6 || nose.length < 4 || mouth.length < 4) {
    return null;
  }

  const leftEyeCenter = center(leftEye);
  const rightEyeCenter = center(rightEye);
  const eyeCenter = center([leftEyeCenter, rightEyeCenter]);
  const noseTip = nose[nose.length - 1];
  const mouthCenter = center(mouth);
  const eyeDistance = distance(leftEyeCenter, rightEyeCenter);
  const faceHeight = Math.max(1, distance(eyeCenter, mouthCenter));
  const horizontalNoseOffset = Math.abs(noseTip.x - eyeCenter.x) / Math.max(1, eyeDistance);
  const verticalNoseOffset = (noseTip.y - eyeCenter.y) / faceHeight;
  const leftEar = eyeAspectRatio(leftEye);
  const rightEar = eyeAspectRatio(rightEye);
  const ear = (leftEar + rightEar) / 2;
  const earDelta = Math.abs(leftEar - rightEar);

  if (ear < 0.18) return "eyes_closed";
  if (horizontalNoseOffset > 0.34 || verticalNoseOffset < 0.28 || verticalNoseOffset > 0.74) {
    return "look_away";
  }
  if (earDelta > 0.12 || horizontalNoseOffset > 0.25) return "gaze_shift";

  return null;
}

function cleanExperience(experience: ProfileData["experience"]) {
  return experience
    .map((item) => ({
      role: item.role.trim(),
      company: item.company.trim(),
      years: item.years.trim(),
    }))
    .filter((item) => item.role || item.company || item.years);
}

function buildInterviewCvData(cvData: CvData | null, profileData: ProfileData) {
  const skills = profileData.skills.length > 0 ? profileData.skills : cvData?.all_skills ?? [];

  return {
    name: cvData?.name,
    email: cvData?.email,
    phone: cvData?.phone,
    headline: profileData.headline || cvData?.headline,
    all_skills: skills,
    skills,
    experience: cleanExperience(profileData.experience),
    education: cvData?.education ?? [],
    projects: cvData?.projects ?? [],
    certifications: cvData?.certifications ?? [],
    best_role: cvData?.best_role,
    bestRole: cvData?.best_role,
  };
}

function badgeColor(tier?: string | null) {
  if (tier === "gold") return "yellow";
  if (tier === "silver") return "gray";
  if (tier === "bronze") return "orange";
  return "blue";
}

export function AIInterviewStep({
  cvData,
  profileData,
  report,
  onComplete,
  allowSkip = false,
}: AIInterviewStepProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestionData | null>(null);
  const [answer, setAnswer] = useState("");
  const [answeredCount, setAnsweredCount] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localReport, setLocalReport] = useState<InterviewReportData | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraMessage, setCameraMessage] = useState("Camera proctoring is required before the interview starts.");
  const [proctorViolations, setProctorViolations] = useState(0);
  const [violationReasons, setViolationReasons] = useState<string[]>([]);
  const [faceStatus, setFaceStatus] = useState("Not checked");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastFrameRef = useRef<Uint8ClampedArray | null>(null);
  const violationCooldownRef = useRef<Set<string>>(new Set());
  const sessionIdRef = useRef<string | null>(null);
  const faceApiRef = useRef<FaceApiModule | null>(null);
  const faceApiLoadedRef = useRef(false);
  const gazeViolationFramesRef = useRef(0);
  const noFaceFramesRef = useRef(0);
  const multipleFaceFramesRef = useRef(0);

  const completedReport = report ?? localReport;
  const cvPayload = buildInterviewCvData(cvData, profileData);
  const availableSkills = cvPayload.skills.length;
  const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const skipInterview = () => {
    const skippedReport: InterviewReportData = {
      session_id: `demo-skip-${Date.now()}`,
      candidate_id: cvPayload.email || cvPayload.name || "demo-candidate",
      overall_score: 0,
      raw_score: 0,
      is_verified: false,
      skill_scores: [],
      total_questions: 0,
      cheating_detected: false,
      violations: 0,
      violation_types: ["demo_skip"],
      violation_reasons: [
        {
          type: "demo_skip",
          reason: "AI interview skipped for demo testing.",
          occurred_at: new Date().toISOString(),
        },
      ],
      english_score: 0,
      penalty: 0,
      strong_skills: [],
      badge_tier: null,
      completed_at: new Date().toISOString(),
    };

    setLocalReport(skippedReport);
    onComplete(skippedReport);
  };

  const reportProctorViolation = async (violationType: string) => {
    if (violationCooldownRef.current.has(violationType)) return;

    const reason = VIOLATION_REASONS[violationType] ?? violationType.replace(/_/g, " ");
    violationCooldownRef.current.add(violationType);
    window.setTimeout(() => {
      violationCooldownRef.current.delete(violationType);
    }, 15_000);
    setProctorViolations((current) => current + 1);
    setViolationReasons((current) => [reason, ...current].slice(0, 6));

    if (!sessionIdRef.current) return;

    try {
      const response = await interviewApi.reportViolation({
        session_id: sessionIdRef.current,
        violation_type: violationType,
        reason,
      });
      setProctorViolations(response.violations);
      if (response.closed && response.report) {
        setCurrentQuestion(null);
        setLocalReport(response.report);
        stopCamera();
        if (document.fullscreenElement) {
          await document.exitFullscreen().catch(() => undefined);
        }
        setError(response.reason ?? "Interview closed after too many proctoring violations.");
        onComplete(response.report);
      }
    } catch (err) {
      console.warn("Could not report interview violation", err);
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("blocked");
      setCameraMessage("This browser does not support webcam access.");
      return false;
    }

    setCameraStatus("starting");
    setCameraMessage("Requesting camera permission...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      stopMediaStream(streamRef.current);
      streamRef.current = stream;
      setCameraStatus("active");
      setCameraMessage("Camera is active. Keep your face visible and stay on this tab.");

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      if (!faceApiLoadedRef.current) {
        setFaceStatus("Loading face-api models...");
        const importFromPublic = new Function("url", "return import(url)") as (
          url: string,
        ) => Promise<FaceApiModule>;
        const faceapi = await importFromPublic("/vendor/face-api.esm.js");
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models/face-api"),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models/face-api"),
        ]);
        faceApiRef.current = faceapi;
        faceApiLoadedRef.current = true;
        setFaceStatus("Face-api eye tracking ready");
      }

      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          setCameraStatus("stopped");
          setCameraMessage("Camera stopped during the interview.");
          void reportProctorViolation("camera_stopped");
        };
        track.onmute = () => {
          setCameraMessage("Camera feed was muted or interrupted.");
          void reportProctorViolation("camera_muted");
        };
      });

      return true;
    } catch (err) {
      setCameraStatus("blocked");
      setCameraMessage("Camera permission is required for the AI interview.");
      setError(err instanceof Error ? err.message : "Camera permission was denied.");
      return false;
    }
  };

  const stopCamera = () => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    lastFrameRef.current = null;
    setCameraStatus("idle");
  };

  const startInterview = async () => {
    if (availableSkills === 0) {
      setError("The interview requires skills extracted from your CV or added in your profile.");
      return;
    }

    setLoading(true);
    setError(null);
    setLocalReport(null);
    try {
      const cameraReady = await startCamera();
      if (!cameraReady) return;

      const data = await interviewApi.start({
        cv_data: cvPayload,
        num_skills: Math.min(3, availableSkills),
      });
      sessionIdRef.current = data.session_id;
      setSessionId(data.session_id);
      setCurrentQuestion(data.first_question);
      setAnsweredCount(0);
      setTotalQuestions(data.total_questions);
      setAnswer("");

      if (!document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          void reportProctorViolation("fullscreen_denied");
        }
      }
    } catch (err: unknown) {
      stopCamera();
      setError(err instanceof Error ? err.message : "Could not start the interview.");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (demoResult?: "right" | "wrong") => {
    if (!sessionId || !currentQuestion) return;
    const finalAnswer = demoResult
      ? `Demo skip: marked ${demoResult}.`
      : answer.trim();
    if (!finalAnswer) return;

    setSubmitting(true);
    setError(null);
    try {
      const data = await interviewApi.submitAnswer({
        session_id: sessionId,
        answer: finalAnswer,
        demo_result: demoResult,
      });

      setAnsweredCount(data.questions_answered);
      setTotalQuestions(data.total_questions);
      setAnswer("");

      if (data.status === "completed" && data.report) {
        setCurrentQuestion(null);
        setLocalReport(data.report);
        stopCamera();
        if (document.fullscreenElement) {
          await document.exitFullscreen().catch(() => undefined);
        }
        onComplete(data.report);
        return;
      }

      setCurrentQuestion(data.next_question);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not submit your answer.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    return () => {
      stopMediaStream(streamRef.current);
    };
  }, []);

  useEffect(() => {
    if (!sessionId || !currentQuestion) return;

    const report = (violationType: string) => {
      void reportProctorViolation(violationType);
    };

    const onVisibilityChange = () => {
      if (document.hidden) report("tab_switch");
    };
    const onBlur = () => report("window_blur");
    const onPaste = (event: ClipboardEvent) => {
      event.preventDefault();
      report("paste_attempt");
    };
    const onCopy = (event: ClipboardEvent) => {
      event.preventDefault();
      report("copy_attempt");
    };
    const onCut = (event: ClipboardEvent) => {
      event.preventDefault();
      report("cut_attempt");
    };
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      report("context_menu_attempt");
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) report("fullscreen_exit");
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("paste", onPaste);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [currentQuestion, sessionId]);

  useEffect(() => {
    if (!sessionId || !currentQuestion || !streamRef.current) return;

    const intervalId = window.setInterval(async () => {
      const stream = streamRef.current;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const track = stream?.getVideoTracks()[0];
      const faceapi = faceApiRef.current;

      if (!stream || !video || !canvas || !track || track.readyState !== "live") {
        setCameraStatus("stopped");
        setCameraMessage("Camera feed is not live.");
        void reportProctorViolation("camera_stopped");
        return;
      }

      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        setCameraMessage("Camera frame is not available.");
        void reportProctorViolation("camera_no_frame");
        return;
      }

      const width = 96;
      const height = 72;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;

      context.drawImage(video, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height).data;
      let brightness = 0;
      let frameDiff = 0;
      const previousFrame = lastFrameRef.current;

      for (let index = 0; index < imageData.length; index += 4) {
        brightness += (imageData[index] + imageData[index + 1] + imageData[index + 2]) / 3;
        if (previousFrame) {
          frameDiff += Math.abs(imageData[index] - previousFrame[index]);
        }
      }

      const pixelCount = imageData.length / 4;
      brightness = brightness / pixelCount;
      frameDiff = previousFrame ? frameDiff / pixelCount : 100;
      lastFrameRef.current = new Uint8ClampedArray(imageData);

      if (brightness < 18) {
        setCameraMessage("Camera frame is too dark or covered.");
        void reportProctorViolation("camera_dark_or_covered");
      } else if (frameDiff < 0.15) {
        setCameraMessage("Camera frame appears frozen or static.");
        void reportProctorViolation("camera_static_frame");
      } else {
        setCameraMessage("Camera is active. Keep your face visible and stay on this tab.");
      }

      if (!faceapi || !faceApiLoadedRef.current) {
        setFaceStatus("Face-api models are not loaded");
        return;
      }

      try {
        const detections = (await faceapi
          .detectAllFaces(
            video,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }),
          )
          .withFaceLandmarks(true)) as unknown as FaceApiDetection[];

        if (detections.length === 0) {
          noFaceFramesRef.current += 1;
          multipleFaceFramesRef.current = 0;
          gazeViolationFramesRef.current = 0;
          setFaceStatus("No face detected");
          if (noFaceFramesRef.current >= 2) void reportProctorViolation("no_face_detected");
        } else if (detections.length > 1) {
          multipleFaceFramesRef.current += 1;
          noFaceFramesRef.current = 0;
          gazeViolationFramesRef.current = 0;
          setFaceStatus("Multiple faces detected");
          if (multipleFaceFramesRef.current >= 2) void reportProctorViolation("multiple_faces_detected");
        } else {
          noFaceFramesRef.current = 0;
          multipleFaceFramesRef.current = 0;
          const violation = getLandmarkViolation(detections[0].landmarks);

          if (violation) {
            gazeViolationFramesRef.current += 1;
            setFaceStatus(VIOLATION_REASONS[violation] ?? "Face landmark violation");
            if (gazeViolationFramesRef.current >= 2) void reportProctorViolation(violation);
          } else {
            gazeViolationFramesRef.current = 0;
            setFaceStatus("Face and gaze aligned");
          }
        }
      } catch {
        setFaceStatus("Face-api detection unavailable");
      }
    }, 2_500);

    return () => window.clearInterval(intervalId);
  }, [currentQuestion, sessionId]);

  return (
    <Paper withBorder radius="md" p="lg" bg="var(--app-surface)">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Group>
            <ThemeIcon size={46} radius="md" color="cyan" variant="light">
              <BrainCircuit size={24} />
            </ThemeIcon>
            <Stack gap={0}>
              <Title order={3} c="var(--app-text-strong)">
                AI technical interview
              </Title>
              <Text c="var(--app-text)" fz="sm">
                Answer adaptive questions generated from your CV and corrected profile data.
              </Text>
            </Stack>
          </Group>
          {completedReport && (
            <Badge color={completedReport.is_verified ? "teal" : "orange"} variant="light" size="lg">
              {completedReport.is_verified ? "Verified" : "Completed"}
            </Badge>
          )}
        </Group>

        {error && (
          <Alert icon={<AlertCircle size={16} />} color="red" title="Interview error" radius="md">
            {error}
          </Alert>
        )}

        {!completedReport && (
          <Card withBorder radius="md" p="md" bg="var(--app-active-bg)">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Stack gap="sm">
                <Group gap="xs">
                  <Camera size={18} />
                  <Text fw={700} c="var(--app-text)">
                    Camera proctoring
                  </Text>
                </Group>
                <Text fz="sm" c="var(--app-text)">
                  Webcam access is required. The interview monitors camera interruptions, covered/dark frames,
                  face-api eye/head landmarks for look-away and gaze shifts, multiple faces, tab switching,
                  paste/copy/cut attempts, context menu use, window blur, and fullscreen exits.
                </Text>
                <Group gap="xs" wrap="wrap">
                  <Badge color={cameraStatus === "active" ? "teal" : cameraStatus === "blocked" || cameraStatus === "stopped" ? "red" : "gray"} variant="light">
                    Camera: {cameraStatus}
                  </Badge>
                  <Badge color="cyan" variant="light">
                    {faceStatus}
                  </Badge>
                  <Badge color={proctorViolations > 0 ? "orange" : "teal"} variant="light">
                    Violations: {proctorViolations}
                  </Badge>
                </Group>
                <Text fz="xs" c="dimmed">
                  {cameraMessage}
                </Text>
                {violationReasons.length > 0 && (
                  <Stack gap={4}>
                    <Text fz="xs" fw={700} c="var(--app-text)">
                      Latest violation reasons
                    </Text>
                    {violationReasons.map((reason, index) => (
                      <Text key={`${reason}-${index}`} fz="xs" c="dimmed">
                        - {reason}
                      </Text>
                    ))}
                  </Stack>
                )}
              </Stack>

              <Card withBorder radius="md" p="xs" bg="var(--app-surface)">
                <Stack gap="xs">
                  <Group gap="xs">
                    <Eye size={16} />
                    <Text fw={700} fz="sm" c="var(--app-text)">
                      Live preview
                    </Text>
                  </Group>
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    autoPlay
                    style={{
                      width: "100%",
                      aspectRatio: "16 / 9",
                      borderRadius: 10,
                      background: "#0f172a",
                      objectFit: "cover",
                      transform: "scaleX(-1)",
                    }}
                  />
                  <canvas ref={canvasRef} style={{ display: "none" }} />
                </Stack>
              </Card>
            </SimpleGrid>
          </Card>
        )}

        {completedReport ? (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Card withBorder radius="md" p="md" bg="var(--app-active-bg)">
              <Group align="center" gap="lg">
                <RingProgress
                  size={140}
                  thickness={14}
                  roundCaps
                  sections={[{ value: completedReport.overall_score, color: completedReport.is_verified ? "teal" : "cyan" }]}
                  label={
                    <Text ta="center" fw={800} c="var(--app-text-strong)">
                      {completedReport.overall_score}%
                    </Text>
                  }
                />
                <Stack gap={6}>
                  <Group gap="xs">
                    <ShieldCheck size={18} />
                    <Text fw={700} c="var(--app-text)">
                      Interview report
                    </Text>
                  </Group>
                  <Text fz="sm" c="var(--app-text)">
                    English score: {completedReport.english_score ?? 0}%
                  </Text>
                  <Text fz="sm" c="var(--app-text)">
                    Questions completed: {completedReport.total_questions}
                  </Text>
                  <Badge color={badgeColor(completedReport.badge_tier)} variant="light" w="fit-content">
                    {completedReport.badge_tier ? `${completedReport.badge_tier} badge` : "No badge yet"}
                  </Badge>
                </Stack>
              </Group>
            </Card>

            <Card withBorder radius="md" p="md">
              <Text fw={700} c="var(--app-text)" mb="xs">
                Skill breakdown
              </Text>
              <Stack gap="xs">
                {completedReport.skill_scores.map((item) => (
                  <Stack key={item.skill} gap={4}>
                    <Group justify="space-between">
                      <Text fz="sm" c="var(--app-text)">
                        {item.skill}
                      </Text>
                      <Text fz="sm" fw={700} c="var(--app-text)">
                        {item.score}%
                      </Text>
                    </Group>
                    <Progress value={item.score} color="cyan" radius="xl" />
                  </Stack>
                ))}
              </Stack>
            </Card>
          </SimpleGrid>
        ) : currentQuestion ? (
          <Stack gap="md">
            <Card withBorder radius="md" p="md" bg="var(--app-active-bg)">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Badge color="cyan" variant="light">
                    Question {currentQuestion.question_number} of {currentQuestion.total_questions}
                  </Badge>
                  <Badge color="indigo" variant="light">
                    {currentQuestion.skill_name}
                  </Badge>
                </Group>
                <Progress value={progress} color="cyan" radius="xl" />
                <Divider />
                <Group gap="xs">
                  <MessageSquareText size={18} />
                  <Text fw={700} c="var(--app-text)">
                    {currentQuestion.focus_concept}
                  </Text>
                </Group>
                <Text c="var(--app-text)" lh={1.7}>
                  {currentQuestion.question_text}
                </Text>
              </Stack>
            </Card>

            <Textarea
              label="Your answer"
              placeholder="Use concrete examples from your projects, decisions, and tradeoffs."
              minRows={7}
              value={answer}
              onChange={(event) => setAnswer(event.currentTarget.value)}
              styles={fieldLabelStyles}
              disabled={submitting}
            />

            <Group justify="flex-end">
              <Button
                color="red"
                variant="light"
                onClick={() => submitAnswer("wrong")}
                loading={submitting}
              >
                Demo wrong
              </Button>
              <Button
                color="teal"
                variant="light"
                onClick={() => submitAnswer("right")}
                loading={submitting}
              >
                Demo right
              </Button>
              <Button onClick={() => submitAnswer()} loading={submitting} disabled={!answer.trim()}>
                Submit answer
              </Button>
            </Group>
          </Stack>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Card withBorder radius="md" p="md" bg="var(--app-active-bg)">
              <Stack gap="sm">
                <Group gap="xs">
                  <CheckCircle size={18} color="var(--mantine-color-teal-6)" />
                  <Text fw={700} c="var(--app-text)">
                    Ready from your CV
                  </Text>
                </Group>
                <Text fz="sm" c="var(--app-text)">
                  The interview tests up to 3 CV/profile skills with 1 main question and 3 follow-ups per skill.
                </Text>
                <Group gap="xs" wrap="wrap">
                  {cvPayload.skills.slice(0, 10).map((skill) => (
                    <Badge key={skill} color="cyan" variant="light">
                      {skill}
                    </Badge>
                  ))}
                </Group>
                {cvPayload.skills.length === 0 && (
                  <Alert color="orange" icon={<AlertCircle size={16} />} radius="md">
                    Add at least one skill in your profile step before starting the interview.
                  </Alert>
                )}
                <Group mt="sm">
                  <Button onClick={startInterview} loading={loading} disabled={cvPayload.skills.length === 0}>
                    Start AI interview
                  </Button>
                  {allowSkip && (
                    <Button variant="subtle" color="gray" onClick={skipInterview} disabled={loading}>
                      Skip for demo
                    </Button>
                  )}
                </Group>
              </Stack>
            </Card>

            <Card withBorder radius="md" p="md">
              <Text fw={700} c="var(--app-text)" mb="xs">
                What this validates
              </Text>
              <List spacing={6} fz="sm" c="var(--app-text)">
                <List.Item>Technical depth from your claimed skills</List.Item>
                <List.Item>Practical project judgment and tradeoffs</List.Item>
                <List.Item>Written English clarity for client communication</List.Item>
                <List.Item>Verification score saved to your freelancer profile</List.Item>
              </List>
            </Card>
          </SimpleGrid>
        )}
      </Stack>
    </Paper>
  );
}
