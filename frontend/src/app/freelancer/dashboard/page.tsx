"use client";

import { useState } from "react";
import { Box, Container, useMantineColorScheme } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  Sidebar,
  HeaderBanner,
  HomeSection,
  JobsSection,
  EarningsSection,
  EditProfileModal,
  ApplyModal,
} from "@/components/freelancer/dashboard";
import {
  MOCK_PROFILE,
  MOCK_JOBS,
  MOCK_PROPOSALS,
  MOCK_EARNINGS,
} from "@/components/freelancer/dashboard/data";
import type { Section, Job, EditFormState } from "@/components/freelancer/dashboard/types";

export default function FreelancerDashboardPage() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const [activeSection, setActiveSection] = useState<Section>("home");

  // Edit modal
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [editForm, setEditForm] = useState<EditFormState>({
    name: MOCK_PROFILE.name,
    headline: MOCK_PROFILE.headline,
    about: MOCK_PROFILE.about,
    country: MOCK_PROFILE.country,
    hourlyRate: MOCK_PROFILE.hourlyRate,
    experienceLevel: MOCK_PROFILE.experienceLevel,
    availability: MOCK_PROFILE.availability,
    skills: [...MOCK_PROFILE.skills],
    portfolioLinks: [...MOCK_PROFILE.portfolioLinks],
  });

  // Apply modal
  const [applyJob, setApplyJob] = useState<Job | null>(null);
  const [applyOpened, { open: openApply, close: closeApply }] = useDisclosure(false);

  const profileCompletion = 85;
  const acceptedCount = MOCK_PROPOSALS.filter((p) => p.status === "accepted").length;
  const pendingCount = MOCK_PROPOSALS.filter((p) => p.status === "pending").length;

  function handleApply(job: Job) {
    setApplyJob(job);
    openApply();
  }

  return (
    <Box style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        pendingCount={pendingCount}
        onEditClick={openEdit}
      />

      <Box
        style={{
          flex: 1,
          marginLeft: 260,
          minHeight: "100vh",
          backgroundColor: isDark ? "#2d3250" : "#f8fafc",
        }}
      >
        <HeaderBanner
          profile={MOCK_PROFILE}
          profileCompletion={profileCompletion}
          acceptedCount={acceptedCount}
          pendingCount={pendingCount}
          onEditClick={openEdit}
        />

        <Container size="xl" py="xl">
          {activeSection === "home" && (
            <HomeSection
              profile={MOCK_PROFILE}
              proposals={MOCK_PROPOSALS}
              profileCompletion={profileCompletion}
              onEditClick={openEdit}
            />
          )}
          {activeSection === "jobs" && (
            <JobsSection jobs={MOCK_JOBS} onApply={handleApply} />
          )}
          {activeSection === "earnings" && (
            <EarningsSection earnings={MOCK_EARNINGS} />
          )}
        </Container>
      </Box>

      <EditProfileModal
        opened={editOpened}
        onClose={closeEdit}
        form={editForm}
        setForm={setEditForm}
        onSave={closeEdit}
      />
      <ApplyModal opened={applyOpened} onClose={closeApply} job={applyJob} />
    </Box>
  );
}
