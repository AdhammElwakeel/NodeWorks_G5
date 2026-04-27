"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingLayout } from "./components/OnboardingLayout";
import { CVUploadStep } from "./components/CVUploadStep";
import { ProfileStep } from "./components/ProfileStep";
import { AIInterviewStep } from "./components/AIInterviewStep";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { profileApi, cvApi } from "@/lib/api";
import { notifications } from "@mantine/notifications";

type OnboardingStep = 0 | 1 | 2;

const steps = [
  { key: "cv", title: "Upload CV", description: "CV extraction and profile pre-fill" },
  { key: "profile", title: "Complete Profile", description: "Add required freelancer details" },
  { key: "ai", title: "AI Interview", description: "Readiness and voice interview" },
] as const;

export default function FreelancerOnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>(0);
  const [cvExtracted, setCvExtracted] = useState(false);
  const [cvFileName, setCvFileName] = useState<string | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);

  // Profile step state
  const [skills, setSkills] = useState<string[]>([]);
  const [headline, setHeadline] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<string | null>(null);
  const [country, setCountry] = useState("");
  const [about, setAbout] = useState("");
  const [saving, setSaving] = useState(false);

  const router = useRouter();

  const completion = useMemo(
    () => Math.round(((step + 1) / steps.length) * 100),
    [step],
  );

  const handleCVUpload = (file: File | null) => {
    setCvFile(file);
    setCvExtracted(Boolean(file));
    setCvFileName(file ? file.name : null);
  };

  const handleStepBack = () =>
    setStep((current) => Math.max(0, current - 1) as OnboardingStep);

  const handleStepNext = () =>
    setStep((current) => Math.min(2, current + 1) as OnboardingStep);

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Upload CV if provided
      if (cvFile) {
        try {
          await cvApi.upload(cvFile);
        } catch {
          // CV upload is optional — don't block onboarding
          console.warn("CV upload failed, continuing...");
        }
      }

      // Save profile
      await profileApi.update({
        profile: {
          headline: headline.trim() || undefined,
          experienceLevel: experienceLevel || undefined,
          country: country.trim() || undefined,
          skills,
          about: about.trim() || undefined,
        },
      });

      notifications.show({
        title: "Onboarding complete!",
        message: "Your freelancer profile is ready. Start browsing jobs.",
        color: "green",
      });
      router.push("/freelancer/dashboard");
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to save your profile. Please try again.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

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
        loading={saving}
      >
        {step === 0 && (
          <CVUploadStep
            cvExtracted={cvExtracted}
            cvFileName={cvFileName}
            onUpload={handleCVUpload}
          />
        )}
        {step === 1 && (
          <ProfileStep
            skills={skills}
            onSkillsChange={setSkills}
            headline={headline}
            onHeadlineChange={setHeadline}
            experienceLevel={experienceLevel}
            onExperienceLevelChange={setExperienceLevel}
            country={country}
            onCountryChange={setCountry}
            about={about}
            onAboutChange={setAbout}
          />
        )}
        {step === 2 && <AIInterviewStep />}
      </OnboardingLayout>
    </ProtectedRoute>
  );
}