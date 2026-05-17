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
import { Briefcase, Search, Filter, Send, DollarSign } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  Sidebar,
  EarningsSection,
} from "@/components/freelancer/dashboard";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { projectApi, proposalApi } from "@/lib/api";
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

  const appliedProjectIds = useMemo(
    () => new Set(proposals.map((proposal) => proposal.projectId)),
    [proposals]
  );

  const acceptedCount = proposals.filter(
    (p) => p.status === "accepted"
  ).length;
  const pendingCount = proposals.filter(
    (p) => p.status === "pending"
  ).length;

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
                    Find the right job for you and apply
                  </Text>
                </Stack>

                {/* My Jobs */}
                <Stack gap="md">
                  <Stack gap={4}>
                    <Title order={3} fw={600} c="var(--app-text)">
                      My Jobs
                    </Title>
                    <Text c="dimmed" fz="sm">
                      Jobs you already applied on
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
                            Browse the recommended jobs below and submit your
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

                {/* Recommended Jobs */}
                <Stack gap="md">
                  <Stack gap={4}>
                    <Title order={3} fw={600} c="var(--app-text)">
                      Recommended Jobs
                    </Title>
                    <Text c="dimmed" fz="sm">
                      Jobs that match your profile
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

                  {loading ? (
                    <Card withBorder radius="md" p="xl">
                      <Center>
                        <Loader color="cyan" />
                      </Center>
                    </Card>
                  ) : filteredRecommended.length === 0 ? (
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
                      {filteredRecommended.map((job) => (
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
                                color="green"
                                variant="light"
                                size="sm"
                                radius="sm"
                              >
                                Open
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
                      ))}
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
