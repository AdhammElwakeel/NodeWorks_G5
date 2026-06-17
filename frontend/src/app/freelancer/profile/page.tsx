"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Box,
  Container,
  Center,
  Loader,
} from "@mantine/core";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { HeaderBanner, HomeSection, Sidebar } from "@/components/freelancer/dashboard";
import { useAuth } from "@/lib/auth-context";
import { proposalApi } from "@/lib/api";
import type { Profile, Proposal } from "@/components/freelancer/dashboard/types";
import type { ProposalData } from "@/lib/api";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function FreelancerProfilePage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileRefreshing, setProfileRefreshing] = useState(false);
  const [profileRefreshAttempted, setProfileRefreshAttempted] = useState(false);

  const fp = user?.freelancerProfile;
  const profile: Profile = useMemo(() => ({
    name: user?.name || "",
    headline: fp?.headline || "",
    role: fp?.experienceLevel || "",
    country: fp?.country || "",
    hourlyRate: fp?.hourlyRate || 0,
    availability: fp?.availability || "",
    about: fp?.about || "",
    skills: fp?.skills || [],
    experienceLevel: fp?.experienceLevel || "",
    portfolioLinks: fp?.portfolioLinks || [],
    completedJobs: 0,
    totalEarnings: 0,
    memberSince: fp?.createdAt ? new Date(fp.createdAt).getFullYear().toString() : new Date().getFullYear().toString(),
    rating: 0,
    reviews: 0,
  }), [fp, user?.name]);

  const profileCompletion = useMemo(() => {
    const fields = [fp?.headline, fp?.about, fp?.country, fp?.hourlyRate, fp?.experienceLevel, fp?.availability, fp?.skills?.length];
    const filled = fields.filter((v) => v && v !== 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [fp]);

  useEffect(() => {
    proposalApi.list({ mine: true })
      .then((data) => setProposals(data.proposals))
      .catch(() => setProposals([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (
      authLoading ||
      !user ||
      user.role !== "freelancer" ||
      user.freelancerProfile ||
      profileRefreshAttempted
    ) {
      return;
    }

    setProfileRefreshAttempted(true);
    setProfileRefreshing(true);
    refreshUser().finally(() => setProfileRefreshing(false));
  }, [authLoading, profileRefreshAttempted, refreshUser, user]);

  const acceptedCount = proposals.filter((p) => p.status === "accepted").length;
  const pendingCount = proposals.filter((p) => p.status === "pending").length;

  const mappedProposals: Proposal[] = proposals.map((proposal) => ({
    id: proposal.id,
    projectTitle: proposal.projectTitle || "Project",
    status: proposal.status,
    coverLetter: proposal.coverLetter,
    proposedRate: proposal.proposedRate,
    submittedAt: formatDate(proposal.submittedAt),
  }));

  const waitingForProfileRefresh =
    !authLoading &&
    user?.role === "freelancer" &&
    !user.freelancerProfile &&
    !profileRefreshAttempted;

  if (authLoading || loading || profileRefreshing || waitingForProfileRefresh) {
    return (
      <ProtectedRoute requiredRole="freelancer">
        <Center style={{ minHeight: "100vh" }}>
          <Loader color="cyan" />
        </Center>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="freelancer">
      <Box style={{ display: "flex", minHeight: "100vh" }}>
        <Box
          visibleFrom="md"
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            zIndex: 200,
            flexShrink: 0,
          }}
        >
          <Sidebar activeSection="profile" onSectionChange={() => {}} />
        </Box>

        <Box style={{ flex: 1, minHeight: "100vh", backgroundColor: "var(--app-bg)" }}>
          <HeaderBanner
            profile={profile}
            profileCompletion={profileCompletion}
            acceptedCount={acceptedCount}
            pendingCount={pendingCount}
            proposalsCount={proposals.length}
          />
          <Container size="lg" py="xl">
            <HomeSection
              profile={profile}
              proposals={mappedProposals}
              profileCompletion={profileCompletion}
            />
          </Container>
        </Box>
      </Box>
    </ProtectedRoute>
  );
}
