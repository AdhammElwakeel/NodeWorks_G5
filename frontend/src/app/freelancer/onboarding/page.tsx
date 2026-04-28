"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingLayout } from "./components/OnboardingLayout";
import { CVUploadStep, type CvData } from "./components/CVUploadStep";
import { ProfileStep, type ProfileData } from "./components/ProfileStep";
import { AIInterviewStep } from "./components/AIInterviewStep";
import { ProtectedRoute } from "@/components/ProtectedRoute";

type OnboardingStep = 0 | 1 | 2;

const steps = [
  {
    key: "cv",
    title: "Upload CV",
    description: "CV extraction and profile pre-fill",
  },
  {
    key: "profile",
    title: "Complete Profile",
    description: "Add required freelancer details",
  },
  {
    key: "ai",
    title: "AI Interview",
    description: "Readiness and voice interview",
  },
] as const;

const CV_ANALYSIS_URL =
  process.env.NEXT_PUBLIC_CV_ANALYSIS_API_URL ?? "http://localhost:8000/api/analyze-cv";

export default function FreelancerOnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>(0);

  // --- CV upload & analysis state ---
  const [cvExtracted, setCvExtracted] = useState(false);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [cvData, setCvData] = useState<CvData | null>(null);

  // --- Profile form state (lifted here so it survives step transitions) ---
  const [profileData, setProfileData] = useState<ProfileData>({
    headline: "",
    experienceLevel: null,
    country: "",
    skills: [],
    bio: "",
  });

  const router = useRouter();

  const completion = useMemo(
    () => Math.round(((step + 1) / steps.length) * 100),
    [step],
  );

  // -------------------------------------------------------------------------
  // Step 0: user selects a file → immediately POST it to the CV analyzer API
  // -------------------------------------------------------------------------
  const handleCVUpload = async (file: File | null) => {
    // Reset state whenever the user picks a new file (or clears)
    setCvExtracted(false);
    setCvFileName(null);
    setCvData(null);
    setAnalysisError(null);

    if (!file) return;

    setCvFileName(file.name);
    setIsAnalyzing(true);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(CV_ANALYSIS_URL, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err?.detail ?? "CV analysis failed");
      }

      const data: CvData = await res.json();
      setCvData(data);
      setCvExtracted(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setAnalysisError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStepBack = () =>
    setStep((current) => Math.max(0, current - 1) as OnboardingStep);

  const handleStepNext = () =>
    setStep((current) => Math.min(2, current + 1) as OnboardingStep);

  const handleFinish = () => router.push("/freelancer/dashboard");

  // Can only proceed from step 0 if analysis completed successfully
  const canContinue = step !== 0 || (cvExtracted && !isAnalyzing);

  return (
    <ProtectedRoute requiredRole="freelancer">
      <OnboardingLayout
        steps={steps}
        step={step}
        completion={completion}
        onBack={handleStepBack}
        onNext={handleStepNext}
        onFinish={handleFinish}
        canContinue={canContinue}
      >
        {step === 0 && (
          <CVUploadStep
            cvExtracted={cvExtracted}
            cvFileName={cvFileName}
            isAnalyzing={isAnalyzing}
            analysisError={analysisError}
            cvData={cvData}
            onUpload={handleCVUpload}
          />
        )}
        {step === 1 && (
          <ProfileStep
            cvData={cvData}
            profileData={profileData}
            onProfileChange={setProfileData}
          />
        )}
        {step === 2 && <AIInterviewStep />}
      </OnboardingLayout>
    </ProtectedRoute>
  );
}
