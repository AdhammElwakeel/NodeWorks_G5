"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingLayout } from "./components/OnboardingLayout";
import { CVUploadStep } from "./components/CVUploadStep";
import { ProfileStep } from "./components/ProfileStep";
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

export default function FreelancerOnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>(0);
  const [cvExtracted, setCvExtracted] = useState(false);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>(["React", "TypeScript"]);
  const router = useRouter();

  const completion = useMemo(
    () => Math.round(((step + 1) / steps.length) * 100),
    [step],
  );

  const handleCVUpload = (file: File | null) => {
    setCvExtracted(Boolean(file));
    setCvFileName(file ? file.name : null);
  };

  const handleStepBack = () =>
    setStep((current) => Math.max(0, current - 1) as OnboardingStep);

  const handleStepNext = () =>
    setStep((current) => Math.min(2, current + 1) as OnboardingStep);

  const handleFinish = () => router.push("/freelancer/dashboard");

  const canContinue = step !== 0 || cvExtracted;

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
          onUpload={handleCVUpload}
        />
      )}
      {step === 1 && <ProfileStep skills={skills} onSkillsChange={setSkills} />}
      {step === 2 && <AIInterviewStep />}
    </OnboardingLayout>
    </ProtectedRoute>
  );
}
