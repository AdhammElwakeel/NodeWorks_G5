"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Box,
  Container,
  Title,
  Text,
  Group,
  Stack,
  Card,
  Badge,
  SimpleGrid,
  Divider,
  TextInput,
  Select,
  Button,
  Center,
} from "@mantine/core";
import {
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  Filter,
  Loader,
  Search,
  SearchX,
  SendHorizontal,
  UsersRound,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/freelancer/dashboard";
import { useRouter } from "next/navigation";
import { projectApi, proposalApi } from "@/lib/api";
import type { ProjectData, ProposalData } from "@/lib/api";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function BrowseJobsPage() {
  const router = useRouter();

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

  const allJobSkills = useMemo(
    () => Array.from(new Set(projects.flatMap((project) => project.skills))),
    [projects]
  );

  const filteredJobs = useMemo(
    () =>
      projects.filter((job) => {
        const matchSearch =
          !search ||
          job.title.toLowerCase().includes(search.toLowerCase()) ||
          job.description.toLowerCase().includes(search.toLowerCase());
        const matchSkill = !skillFilter || job.skills.includes(skillFilter);
        return matchSearch && matchSkill;
      }),
    [projects, search, skillFilter]
  );

  return (
    <ProtectedRoute requiredRole="freelancer">
      <Box style={{ display: "flex", minHeight: "100vh" }}>
        {/* Desktop sidebar stays in layout so expanded hover reserves space. */}
        <Box visibleFrom="md" style={{ position: "sticky", top: 0, height: "100vh", zIndex: 200, flexShrink: 0 }}>
          <Sidebar activeSection="browse" onSectionChange={() => {}} />
        </Box>

        {/* Main content */}
        <Box style={{ flex: 1, minHeight: "100vh", backgroundColor: "var(--app-bg)" }}>
          <Container size="lg" py="xl">
            <Stack gap="xl">
              {/* Page Header */}
              <Stack gap={4}>
                <Title order={2} fw={700} c="var(--app-text-strong)">
                  Browse Jobs
                </Title>
                <Text c="dimmed" fz="lg">
                  Find the right job for you and apply
                </Text>
              </Stack>

              {/* Search & Filter */}
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
                <Button color="cyan" radius="xl" size="md" leftSection={<Search size={16} />}>
                  Search
                </Button>
              </Group>

              {/* Results count */}
              <Text fz="sm" c="dimmed">
                Showing {filteredJobs.length} of {projects.length} open jobs
              </Text>

              {/* All Jobs Grid */}
              {loading ? (
                <Card withBorder radius="md" p="xl">
                  <Center>
                    <Loader size={48} color="#06b6d4" />
                  </Center>
                </Card>
              ) : filteredJobs.length === 0 ? (
                <Card withBorder radius="md" p="xl">
                  <Center>
                    <Stack align="center" gap="sm">
                      <SearchX size={48} strokeWidth={1.6} color="var(--app-muted-soft)" />
                      <Text fw={600} c="var(--app-text)">
                        No jobs found
                      </Text>
                      <Text fz="sm" c="dimmed" ta="center">
                        Try adjusting your search or check back later for new opportunities.
                      </Text>
                    </Stack>
                  </Center>
                </Card>
              ) : (
                <SimpleGrid
                  cols={{ base: 1, sm: 2, lg: 3 }}
                  spacing="md"
                  style={{ alignItems: "start" }}
                >
                  {filteredJobs.map((job) => {
                    const isApplied = appliedProjectIds.has(job.id);
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
                          (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
                          (e.currentTarget as HTMLElement).style.boxShadow = "var(--app-hover-shadow)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                          (e.currentTarget as HTMLElement).style.boxShadow = "none";
                        }}
                      >
                        <Stack gap="sm">
                          <Group justify="space-between">
                            <Badge color={isApplied ? "orange" : "green"} variant="light" size="sm" radius="sm">
                              {isApplied ? "Applied" : "Open"}
                            </Badge>
                            {job.budget ? (
                              <Group gap={4}>
                                <CircleDollarSign
                                  size={14}
                                  strokeWidth={1.8}
                                  color="var(--mantine-color-cyan-6)"
                                />
                                <Text fw={700} fz="sm" c="var(--app-text)">
                                  ${job.budget.toLocaleString()}
                                </Text>
                              </Group>
                            ) : (
                              <Group gap={4}>
                                <BriefcaseBusiness
                                  size={14}
                                  strokeWidth={1.8}
                                  color="var(--app-muted-soft)"
                                />
                                <Text fw={700} fz="sm" c="dimmed">
                                  Budget TBD
                                </Text>
                              </Group>
                            )}
                          </Group>
                          <Text fw={700} c="var(--app-text)" lineClamp={2} fz="lg">
                            {job.title || "Untitled project"}
                          </Text>
                          {job.description ? (
                            <Text fz="sm" c="dimmed" lineClamp={3}>
                              {job.description}
                            </Text>
                          ) : (
                            <Text fz="sm" c="dimmed" fs="italic">
                              No project description provided yet.
                            </Text>
                          )}
                          <Group gap="xs" wrap="wrap">
                            {job.skills.length > 0 ? (
                              <>
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
                              </>
                            ) : (
                              <Badge size="sm" variant="light" color="gray" radius="sm">
                                No skills listed
                              </Badge>
                            )}
                          </Group>
                          <Divider />
                          <Group gap="md" wrap="wrap">
                            <Group gap={4} wrap="nowrap">
                              <CalendarDays
                                size={14}
                                strokeWidth={1.8}
                                color="var(--app-muted-soft)"
                              />
                              <Text fz="xs" c="dimmed">
                                {formatDate(job.createdAt)}
                              </Text>
                            </Group>
                            <Group gap={4} wrap="nowrap">
                              <UsersRound
                                size={14}
                                strokeWidth={1.8}
                                color="var(--app-muted-soft)"
                              />
                              <Text fz="xs" c="dimmed">
                                {job.proposalsCount} proposals
                              </Text>
                            </Group>
                          </Group>
                          <Button
                            fullWidth
                            color={isApplied ? "gray" : "cyan"}
                            radius="md"
                            leftSection={<SendHorizontal size={16} strokeWidth={1.8} />}
                            disabled={isApplied}
                            onClick={() => router.push(`/freelancer/apply/${job.id}`)}
                          >
                            {isApplied ? "Applied" : "Apply Now"}
                          </Button>
                        </Stack>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              )}
            </Stack>
          </Container>
        </Box>
      </Box>
    </ProtectedRoute>
  );
}
