"use client";

import { useState } from "react";
import { Box, Container, Burger, Title, Group, Drawer } from "@mantine/core";
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
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function FreelancerDashboardPage() {
  const [activeSection, setActiveSection] = useState<Section>("home");
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const sidebar = (
    <Sidebar
      activeSection={activeSection}
      onSectionChange={(section) => {
        setActiveSection(section);
        setMobileOpen(false);
      }}
      pendingCount={pendingCount}
      onEditClick={() => {
        openEdit();
        setMobileOpen(false);
      }}
    />
  );

  return (
    <ProtectedRoute requiredRole="freelancer">
      <Box style={{ display: "flex", minHeight: "100vh" }}>
        {/* Desktop sidebar placeholder — reserves 260px in flex layout */}
        <Box visibleFrom="md" w={260} style={{ flexShrink: 0 }} />

        {/* Main content */}
        <Box style={{ flex: 1, minHeight: "100vh", backgroundColor: "#f8fafc" }}>
          {/* Mobile header */}
          <Group
            hiddenFrom="md"
            p="md"
            style={{ borderBottom: "1px solid #e2e8f0", background: "white" }}
          >
            <Burger
              opened={mobileOpen}
              onClick={() => setMobileOpen((o) => !o)}
              size="sm"
            />
            <Title order={5} c="dark.9">
              NodeWorks
            </Title>
          </Group>

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

        {/* Desktop sidebar — fixed over the placeholder */}
        <Box
          visibleFrom="md"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: 260,
            height: "100vh",
            zIndex: 200,
          }}
        >
          {sidebar}
        </Box>

        {/* Mobile drawer */}
        <Drawer
          opened={mobileOpen}
          onClose={() => setMobileOpen(false)}
          size="xs"
          withCloseButton={false}
          padding={0}
          hiddenFrom="md"
        >
          {sidebar}
        </Drawer>
      </Box>
    </ProtectedRoute>
  );
}
