"use client";

import { useState, useEffect } from "react";
import { Box, Container, Burger, Title, Group, Drawer, Loader, Center } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  Sidebar,
  HeaderBanner,
  HomeSection,
  JobsSection,
  EarningsSection,
  ApplyModal,
} from "@/components/freelancer/dashboard";
import type { Section, Job } from "@/components/freelancer/dashboard/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { profileApi, projectApi, proposalApi, type ProjectData, type ProposalData } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { notifications } from "@mantine/notifications";

function adaptProjectToJob(p: ProjectData): Job {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    budget: p.budget,
    budgetType: "fixed",
    skills: p.skills,
    clientName: "Client",
    clientAvatar: "CL",
    postedAt: new Date(p.createdAt).toLocaleDateString(),
    proposals: p.proposalsCount,
    saved: false,
  };
}

interface FreelancerProfile {
  name: string;
  email: string;
  headline: string;
  about: string;
  country: string;
  hourlyRate: number;
  experienceLevel: string;
  availability: string;
  skills: string[];
  portfolioLinks: string[];
  role: string;
  memberSince: string;
  completedJobs: number;
  totalEarnings: number;
  rating: number;
  reviews: number;
}

function userToProfile(user: any, profile: any): FreelancerProfile {
  return {
    name: user?.name || "Freelancer",
    email: user?.email || "",
    headline: profile?.headline || user?.freelancerProfile?.headline || "Freelancer",
    about: profile?.about || user?.freelancerProfile?.about || "",
    country: profile?.country || user?.freelancerProfile?.country || "N/A",
    hourlyRate: profile?.hourlyRate || user?.freelancerProfile?.hourlyRate || 0,
    experienceLevel: profile?.experienceLevel || user?.freelancerProfile?.experienceLevel || "Junior",
    availability: profile?.availability || user?.freelancerProfile?.availability || "Available",
    skills: profile?.skills || user?.freelancerProfile?.skills || [],
    portfolioLinks: profile?.portfolioLinks || user?.freelancerProfile?.portfolioLinks || [],
    role: user?.role || "freelancer",
    memberSince: "2026",
    completedJobs: 0,
    totalEarnings: 0,
    rating: 0,
    reviews: 0,
  };
}

export default function FreelancerDashboardPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>("home");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<FreelancerProfile | null>(null);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [myProposals, setMyProposals] = useState<ProposalData[]>([]);
  const [loading, setLoading] = useState(true);

  const [applyJob, setApplyJob] = useState<Job | null>(null);
  const [applyOpened, { open: openApply, close: closeApply }] = useDisclosure(false);

  const profileCompletion = 50;

  const loadData = async () => {
    setLoading(true);
    try {
      const [profileRes, projectsRes, proposalsRes] = await Promise.all([
        profileApi.get().catch(() => null),
        projectApi.list({ status: "open" }).catch(() => ({ projects: [] })),
        proposalApi.list({ mine: true }).catch(() => ({ proposals: [] })),
      ]);

      if (profileRes) {
        setProfile(userToProfile(profileRes.user, profileRes.user.freelancerProfile));
      }
      setProjects(projectsRes.projects || []);
      setMyProposals(proposalsRes.proposals || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApplySubmit = async (data: { coverLetter: string; proposedRate: number; estimatedDuration?: string }) => {
    if (!applyJob) return;
    try {
      await proposalApi.create({
        projectId: applyJob.id,
        coverLetter: data.coverLetter,
        proposedRate: data.proposedRate,
        estimatedDuration: data.estimatedDuration,
      });
      notifications.show({
        title: "Proposal submitted!",
        message: "Your proposal has been sent to the client.",
        color: "green",
      });
      closeApply();
      loadData();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err?.message || "Failed to submit proposal.",
        color: "red",
      });
      throw err;
    }
  };

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
      pendingCount={myProposals.filter((p) => p.status === "pending").length}
    />
  );

  if (loading) {
    return (
      <ProtectedRoute requiredRole="freelancer">
        <Center style={{ minHeight: "100vh" }}>
          <Loader size="lg" color="indigo" />
        </Center>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="freelancer">
      <Box style={{ display: "flex", minHeight: "100vh" }}>
        <Box visibleFrom="md" w={260} style={{ flexShrink: 0 }} />

        <Box style={{ flex: 1, minHeight: "100vh", backgroundColor: "#f8fafc" }}>
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

          {profile && (
            <HeaderBanner
              profile={profile}
              profileCompletion={profileCompletion}
              acceptedCount={myProposals.filter((p) => p.status === "accepted").length}
              pendingCount={myProposals.filter((p) => p.status === "pending").length}
            />
          )}

          <Container size="xl" py="xl">
            {activeSection === "home" && profile && (
              <HomeSection
                profile={profile}
                proposals={myProposals.map((p) => ({
                  id: p.id,
                  projectTitle: p.projectTitle || "Project",
                  status: p.status,
                  coverLetter: p.coverLetter,
                  proposedRate: p.proposedRate,
                  submittedAt: p.submittedAt,
                }))}
                profileCompletion={profileCompletion}
              />
            )}
            {activeSection === "jobs" && (
              <JobsSection
                jobs={projects.map(adaptProjectToJob)}
                onApply={handleApply}
              />
            )}
            {activeSection === "earnings" && (
              <EarningsSection
                earnings={{
                  totalEarnings: 0,
                  thisMonth: 0,
                  pending: 0,
                  available: 0,
                  transactions: [],
                  monthlyStats: [],
                }}
              />
            )}
          </Container>
        </Box>

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

      <ApplyModal
        opened={applyOpened}
        onClose={closeApply}
        job={applyJob}
        onSubmit={handleApplySubmit}
      />
    </ProtectedRoute>
  );
}