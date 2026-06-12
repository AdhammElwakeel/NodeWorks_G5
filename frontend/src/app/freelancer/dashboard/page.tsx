"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import {
  Box,
  Container,
  Title,
  Text,
  Group,
  Stack,
  Center,
  Card,
  Badge,
  SimpleGrid,
  Divider,
  TextInput,
  Select,
  Button,
  Loader,
} from "@mantine/core";
import { Briefcase, Search, Filter, Send, DollarSign, Sparkles } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  Sidebar,
  EarningsSection,
} from "@/components/freelancer/dashboard";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { projectApi, proposalApi, recApi } from "@/lib/api";
import { KbsExplanationPanel } from "@/components/kbs/KbsExplanationPanel";
import {
  MOCK_EARNINGS,
} from "@/components/freelancer/dashboard/data";
import type { Section } from "@/components/freelancer/dashboard/types";
import type { ProjectData, ProposalData } from "@/lib/api";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function FreelancerDashboardPage() {
  return (
    <Suspense
      fallback={
        <Center style={{ minHeight: "100vh" }}>
          <Loader color="cyan" />
        </Center>
      }
    >
      <FreelancerDashboardContent />
    </Suspense>
  );
}

function FreelancerDashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const sectionParam = searchParams.get("section");
  let initialSection: Section = "home";
  if (sectionParam === "earnings") initialSection = "earnings";

  const [activeSection, setActiveSection] =
    useState<Section>(initialSection);

  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobRecommendations, setJobRecommendations] = useState<
    {
      score: number;
      reason: string;
      matchedSkills: string[];
      missingSkills: string[];
      project: ProjectData;
    }[]
  >([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      projectApi.list({ status: "open" }),
      proposalApi.list({ mine: true }),
    ])
      .then(([projectData, proposalData]) => {
        setProjects(projectData.projects);
        setProposals(proposalData.proposals);
      })
      .catch(() => {
        setProjects([]);
        setProposals([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setJobRecommendations([]);
      setRecommendationsError(null);
      return;
    }

    setRecommendationsLoading(true);
    recApi
      .jobs({ limit: 12 })
      .then((data) => {
        setJobRecommendations(data.recommendations);
        setRecommendationsError(null);
      })
      .catch((error: any) => {
        setJobRecommendations([]);
        setRecommendationsError(error?.message || "KBS recommendations unavailable");
      })
      .finally(() => setRecommendationsLoading(false));
  }, [user]);

  const appliedProjectIds = useMemo(
    () => new Set(proposals.map((proposal) => proposal.projectId)),
    [proposals]
  );

  const recommendedJobs = useMemo(
    () => projects.filter((project) => !appliedProjectIds.has(project.id)),
    [projects, appliedProjectIds]
  );

  const allJobSkills = useMemo(
    () => Array.from(new Set(projects.flatMap((project) => project.skills))),
    [projects]
  );

  const filteredRecommended = useMemo(
    () =>
      recommendedJobs.filter((job) => {
        const matchSearch =
          !search ||
          job.title.toLowerCase().includes(search.toLowerCase()) ||
          job.description.toLowerCase().includes(search.toLowerCase());
        const matchSkill = !skillFilter || job.skills.includes(skillFilter);
        return matchSearch && matchSkill;
      }),
    [recommendedJobs, search, skillFilter]
  );

  const recommendedFromKbs = jobRecommendations.length > 0;
  const recommendationByProjectId = useMemo(
    () => new Map(jobRecommendations.map((item) => [item.project.id, item])),
    [jobRecommendations]
  );
  const displayedRecommended = useMemo(
    () => filteredRecommended,
    [filteredRecommended]
  );

  const sidebar = (
    <Sidebar
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    />
  );

  return (
    <ProtectedRoute requiredRole="freelancer">
      <Box style={{ display: "flex", minHeight: "100vh" }}>
        {/* Desktop sidebar stays in layout so expanded hover reserves space. */}
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
          {sidebar}
        </Box>

        {/* Main content */}
        <Box style={{ flex: 1, minHeight: "100vh", backgroundColor: "var(--app-bg)" }}>
          {activeSection === "earnings" ? (
            <Container size="lg" py="xl">
              <EarningsSection earnings={MOCK_EARNINGS} />
            </Container>
          ) : (
            <Container size="lg" py="xl">
                <Stack gap="xl">
                {/* Welcome Header */}
                <Stack gap={4}>
                  <Title order={2} fw={700} c="var(--app-text-strong)">
                    Welcome Back, {user?.name?.split(" ")[0] || "Freelancer"}!
                  </Title>
                  <Text c="dimmed" fz="lg">
                    Welcome aboard!
                  </Text>
                </Stack>

                {/* Best Matches */}
                <Stack gap="md">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={4}>
                      <Group gap="xs">
                        <Sparkles size={20} color="var(--mantine-color-violet-6)" />
                        <Title order={3} fw={700} c="var(--app-text)">
                          Best Matches For You
                        </Title>
                      </Group>
                      <Text c="dimmed" fz="sm">
                        Ranked by your graph skills, CV analysis, and project requirements.
                      </Text>
                      {recommendationsError && (
                        <Text c="orange" fz="xs">
                          AI matching is temporarily unavailable. You can still browse open jobs below.
                        </Text>
                      )}
                    </Stack>
                    <Badge color={recommendedFromKbs ? "violet" : "gray"} variant="light">
                      {recommendedFromKbs ? "Graph matched" : "Preparing matches"}
                    </Badge>
                  </Group>

                  {recommendationsLoading ? (
                    <Card withBorder radius="lg" p="xl" bg="var(--app-surface)">
                      <Center>
                        <Stack align="center" gap="xs">
                          <Loader color="violet" />
                          <Text fz="sm" c="dimmed">
                            Preparing your recommendations...
                          </Text>
                        </Stack>
                      </Center>
                    </Card>
                  ) : jobRecommendations.length === 0 ? (
                    <Card withBorder radius="lg" p="xl" bg="var(--app-surface)">
                      <Center>
                        <Stack align="center" gap="sm">
                          <Sparkles size={42} color="var(--app-muted-soft)" />
                          <Text fw={600} c="var(--app-text)">
                            Matches will appear here automatically
                          </Text>
                          <Text fz="sm" c="dimmed" ta="center">
                            Complete your profile and CV analysis to improve graph-based matching.
                          </Text>
                        </Stack>
                      </Center>
                    </Card>
                  ) : (
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                      {jobRecommendations.slice(0, 4).map((item) => (
                        <Card key={item.project.id} withBorder radius="lg" shadow="sm" bg="var(--app-surface)">
                          <Stack gap="sm">
                            <Group justify="space-between" align="flex-start">
                              <Badge color="violet" variant="filled" radius="sm">
                                {item.score}% match
                              </Badge>
                              <Group gap={4}>
                                <DollarSign size={14} color="var(--mantine-color-cyan-6)" />
                                <Text fw={700} fz="sm" c="var(--app-text)">
                                  ${item.project.budget.toLocaleString()}
                                </Text>
                              </Group>
                            </Group>
                            <Text fw={800} fz="lg" c="var(--app-text)" lineClamp={2}>
                              {item.project.title}
                            </Text>
                            <Text fz="sm" c="dimmed" lineClamp={2}>
                              {item.project.description}
                            </Text>
                            <KbsExplanationPanel
                              score={item.score}
                              reason={item.reason}
                              matchedSkills={item.matchedSkills}
                              missingSkills={item.missingSkills}
                              graphPath="Freelancer - HAS_SKILL -> Skill <- REQUIRES_SKILL - Project"
                            />
                            <Group gap="xs" wrap="wrap">
                              {item.matchedSkills.slice(0, 5).map((skill) => (
                                <Badge key={skill} size="sm" color="cyan" variant="light">
                                  {skill}
                                </Badge>
                              ))}
                            </Group>
                            <Button
                              fullWidth
                              color="cyan"
                              radius="md"
                              leftSection={<Send size={16} />}
                              onClick={() => router.push(`/freelancer/apply/${item.project.id}`)}
                            >
                              Apply Now
                            </Button>
                          </Stack>
                        </Card>
                      ))}
                    </SimpleGrid>
                  )}
                </Stack>

                {/* Jobs Search */}
                <Stack gap="md">
                  <Stack gap={4}>
                    <Title order={3} fw={600} c="var(--app-text)">
                      Browse Jobs
                    </Title>
                    <Text c="dimmed" fz="sm">
                      Search all open jobs and compare them with your top matches.
                    </Text>
                  </Stack>

                  <Group gap="md" wrap="wrap">
                    <TextInput
                      placeholder="Search jobs by title or keyword..."
                      leftSection={<Search size={16} color="var(--app-muted-soft)" />}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ flex: 1, minWidth: 250 }}
                      radius="xl"
                      size="md"
                      styles={{
                        input: {
                          backgroundColor: "var(--app-surface)",
                          border: "1px solid var(--app-border)",
                          boxShadow: "var(--app-focus-shadow)",
                        },
                      }}
                    />
                    <Select
                      placeholder="Filter by skill"
                      data={allJobSkills}
                      value={skillFilter}
                      onChange={setSkillFilter}
                      clearable
                      leftSection={<Filter size={16} color="var(--app-muted-soft)" />}
                      style={{ minWidth: 180 }}
                      radius="xl"
                      size="md"
                      styles={{
                        input: {
                          backgroundColor: "var(--app-surface)",
                          border: "1px solid var(--app-border)",
                          boxShadow: "var(--app-focus-shadow)",
                        },
                      }}
                    />
                    <Button
                      color="cyan"
                      radius="xl"
                      size="md"
                      leftSection={<Search size={16} />}
                    >
                      Search
                    </Button>
                  </Group>
                </Stack>

                {/* Applications */}
                <Stack gap="md">
                  <Stack gap={4}>
                    <Title order={3} fw={600} c="var(--app-text)">
                      Applications
                    </Title>
                    <Text c="dimmed" fz="sm">
                      Jobs you already applied to
                    </Text>
                  </Stack>

                  {loading ? (
                    <Card withBorder radius="md" p="xl">
                      <Center>
                        <Loader color="cyan" />
                      </Center>
                    </Card>
                  ) : proposals.length === 0 ? (
                    <Card withBorder radius="md" p="xl">
                      <Center>
                        <Stack align="center" gap="sm">
                          <Briefcase size={48} color="var(--app-muted-soft)" />
                          <Text fw={600} c="var(--app-text)">
                            You didn&apos;t apply to any job yet
                          </Text>
                          <Text fz="sm" c="dimmed" ta="center">
                            Browse your recommended jobs above and submit your
                            first proposal!
                          </Text>
                        </Stack>
                      </Center>
                    </Card>
                  ) : (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                      {proposals.map((proposal) => (
                        <Card key={proposal.id} withBorder radius="md" shadow="sm">
                          <Stack gap="sm">
                            <Group justify="space-between">
                              <Badge
                                color={
                                  proposal.status === "accepted"
                                    ? "green"
                                    : proposal.status === "rejected"
                                      ? "red"
                                      : "orange"
                                }
                                variant="light"
                                size="sm"
                                radius="sm"
                              >
                                {proposal.status}
                              </Badge>
                              <Group gap={4}>
                                <DollarSign
                                  size={14}
                                  color="var(--mantine-color-cyan-6)"
                                />
                                <Text fw={700} fz="sm" c="var(--app-text)">
                                  ${proposal.proposedRate.toLocaleString()}
                                </Text>
                              </Group>
                            </Group>
                            <Text fw={700} c="var(--app-text)" lineClamp={2}>
                              {proposal.projectTitle || "Project"}
                            </Text>
                            <Text fz="sm" c="dimmed" lineClamp={2}>
                              {proposal.coverLetter}
                            </Text>
                            <Divider />
                            <Group justify="space-between">
                              <Text fz="xs" c="dimmed">
                                Submitted {formatDate(proposal.submittedAt)}
                              </Text>
                            </Group>
                          </Stack>
                        </Card>
                      ))}
                    </SimpleGrid>
                  )}
                </Stack>

                {/* All Open Jobs */}
                <Stack gap="md">
                  <Stack gap={4}>
                    <Title order={3} fw={600} c="var(--app-text)">
                      All Open Jobs
                    </Title>
                    <Text c="dimmed" fz="sm">
                      Filter the full marketplace after reviewing your best matches.
                    </Text>
                  </Stack>

                  {loading ? (
                    <Card withBorder radius="md" p="xl">
                      <Center>
                        <Loader color="cyan" />
                      </Center>
                    </Card>
                  ) : displayedRecommended.length === 0 ? (
                    <Card withBorder radius="md" p="xl">
                      <Center>
                        <Stack align="center" gap="sm">
                          <Briefcase size={48} color="var(--app-muted-soft)" />
                          <Text fw={600} c="var(--app-text)">
                            No jobs found
                          </Text>
                          <Text fz="sm" c="dimmed" ta="center">
                            Try adjusting your search or check back later for
                            new opportunities.
                          </Text>
                        </Stack>
                      </Center>
                    </Card>
                  ) : (
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                      {displayedRecommended.map((job) => {
                        const recommendation = recommendationByProjectId.get(job.id);
                        return (
                        <Card
                          key={job.id}
                          withBorder
                          radius="md"
                          shadow="sm"
                          style={{
                            transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.transform =
                              "translateY(-4px)";
                            (e.currentTarget as HTMLElement).style.boxShadow =
                              "var(--app-hover-shadow)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.transform =
                              "translateY(0)";
                            (e.currentTarget as HTMLElement).style.boxShadow =
                              "none";
                          }}
                        >
                          <Stack gap="sm">
                            <Group justify="space-between">
                              <Badge
                                color={recommendation ? "violet" : "green"}
                                variant="light"
                                size="sm"
                                radius="sm"
                              >
                                {recommendation ? `${recommendation.score}% match` : "Open"}
                              </Badge>
                              {job.budget && (
                                <Group gap={4}>
                                  <DollarSign
                                    size={14}
                                    color="var(--mantine-color-cyan-6)"
                                  />
                                  <Text fw={700} fz="sm" c="var(--app-text)">
                                    ${job.budget.toLocaleString()}
                                  </Text>
                                </Group>
                              )}
                            </Group>
                            <Text fw={700} c="var(--app-text)" lineClamp={2} fz="lg">
                              {job.title}
                            </Text>
                            <Text fz="sm" c="dimmed" lineClamp={3}>
                              {job.description}
                            </Text>
                            {recommendation && (
                              <KbsExplanationPanel
                                score={recommendation.score}
                                reason={recommendation.reason}
                                matchedSkills={recommendation.matchedSkills}
                                missingSkills={recommendation.missingSkills}
                                graphPath="Freelancer - HAS_SKILL -> Skill <- REQUIRES_SKILL - Project"
                              />
                            )}
                            <Group gap="xs" wrap="wrap">
                              {job.skills.slice(0, 4).map((s: string) => (
                                <Badge
                                  key={s}
                                  size="sm"
                                  variant="light"
                                  color="cyan"
                                  radius="sm"
                                >
                                  {s}
                                </Badge>
                              ))}
                              {job.skills.length > 4 && (
                                <Badge
                                  size="sm"
                                  variant="light"
                                  color="gray"
                                  radius="sm"
                                >
                                  +{job.skills.length - 4}
                                </Badge>
                              )}
                            </Group>
                            <Divider />
                            <Text fz="xs" c="dimmed">
                              {formatDate(job.createdAt)} · {job.proposalsCount} proposals
                            </Text>
                            <Button
                              fullWidth
                              color="cyan"
                              radius="md"
                              leftSection={<Send size={16} />}
                              onClick={() =>
                                router.push(`/freelancer/apply/${job.id}`)
                              }
                            >
                              Apply Now
                            </Button>
                          </Stack>
                        </Card>
                        );
                      })}
                    </SimpleGrid>
                  )}
                </Stack>
              </Stack>
            </Container>
          )}
        </Box>
      </Box>
    </ProtectedRoute>
  );
}
