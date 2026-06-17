"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Card,
  SimpleGrid,
  Stack,
  Text,
  Button,
  Group,
  Badge,
  Loader,
  Select,
  Avatar,
  Center,
  Divider,
} from "@mantine/core";
import { Plus, FolderOpen, CheckCircle, Clock, Sparkles, User, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/client/PageHeader";
import { StatusBadge } from "@/components/client/StatusBadge";
import { SkillsTags } from "@/components/client/SkillsTags";
import { projectApi, recApi, type ProjectData } from "@/lib/api";
import { KbsExplanationPanel } from "@/components/kbs/KbsExplanationPanel";

type FreelancerRecommendation = Awaited<
  ReturnType<typeof recApi.freelancers>
>["recommendations"][number];
type TeamRecommendation = Awaited<
  ReturnType<typeof recApi.team>
>["recommendations"][number];

export default function ClientDashboardPage() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [freelancerRecommendations, setFreelancerRecommendations] = useState<FreelancerRecommendation[]>([]);
  const [teamRecommendations, setTeamRecommendations] = useState<TeamRecommendation[]>([]);
  const [requiredRoles, setRequiredRoles] = useState<{ name: string; count: number }[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);

  useEffect(() => {
    projectApi
      .list({ mine: true })
      .then((data) => setProjects(data.projects))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedProjectId || projects.length === 0) return;
    const firstOpenProject = projects.find((project) => project.status === "open") || projects[0];
    queueMicrotask(() => setSelectedProjectId(firstOpenProject.id));
  }, [projects, selectedProjectId]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedProjectId) {
      queueMicrotask(() => {
        if (cancelled) return;
        setFreelancerRecommendations([]);
        setTeamRecommendations([]);
        setRequiredRoles([]);
      });
      return;
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setRecommendationsLoading(true);
      setRecommendationsError(null);
    });

    Promise.all([
      recApi.freelancers(selectedProjectId, { limit: 6 }),
      recApi.team(selectedProjectId, { limit: 2, maxTeamSize: 4 }),
    ])
      .then(([freelancerData, teamData]) => {
        if (cancelled) return;
        setFreelancerRecommendations(freelancerData.recommendations || []);
        setTeamRecommendations(teamData.recommendations || []);
        setRequiredRoles(teamData.requiredRoles || []);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFreelancerRecommendations([]);
        setTeamRecommendations([]);
        setRequiredRoles([]);
        setRecommendationsError(
          error instanceof Error
            ? error.message
            : "Recommendations are temporarily unavailable"
        );
      })
      .finally(() => {
        if (!cancelled) setRecommendationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const openCount = projects.filter((p) => p.status === "open").length;
  const closedCount = projects.filter((p) => p.status === "closed").length;
  const totalProposals = projects.reduce(
    (sum, p) => sum + p.proposalsCount,
    0
  );

  const recentProjects = [...projects]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5);

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const projectOptions = projects
    .filter((project) => project.status === "open")
    .map((project) => ({ value: project.id, label: project.title }));

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your projects and proposals"
        actions={
          <Button
            component={Link}
            href="/client/projects/new"
            leftSection={<Plus size={18} />}
            color="teal"
            variant="filled"
            radius="md"
          >
            Create new project
          </Button>
        }
      />

      {/* Stats Cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
        <Card withBorder radius="md" bg="var(--app-surface)">
          <Group>
            <Box
              p="sm"
              style={{
                background: "rgba(34,197,94,0.1)",
                borderRadius: 10,
              }}
            >
              <FolderOpen size={24} color="#22c55e" />
            </Box>
            <Stack gap={2}>
              <Text fz="sm" c="dimmed">
                Open Projects
              </Text>
              <Text fw={700} fz="xl" c="var(--app-text)">
                {openCount}
              </Text>
            </Stack>
          </Group>
        </Card>
        <Card withBorder radius="md" bg="var(--app-surface)">
          <Group>
            <Box
              p="sm"
              style={{
                background: "rgba(107,114,128,0.1)",
                borderRadius: 10,
              }}
            >
              <CheckCircle size={24} color="#6b7280" />
            </Box>
            <Stack gap={2}>
              <Text fz="sm" c="dimmed">
                Closed Projects
              </Text>
              <Text fw={700} fz="xl" c="var(--app-text)">
                {closedCount}
              </Text>
            </Stack>
          </Group>
        </Card>
        <Card withBorder radius="md" bg="var(--app-surface)">
          <Group>
            <Box
              p="sm"
              style={{
                background: "rgba(245,158,11,0.1)",
                borderRadius: 10,
              }}
            >
              <Clock size={24} color="#f59e0b" />
            </Box>
            <Stack gap={2}>
              <Text fz="sm" c="dimmed">
                Pending Proposals
              </Text>
              <Text fw={700} fz="xl" c="var(--app-text)">
                {totalProposals}
              </Text>
            </Stack>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Recommended Freelancers */}
      <Card withBorder radius="lg" bg="var(--app-surface)" mb="xl" p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Group gap="xs">
                <Sparkles size={20} color="var(--mantine-color-violet-6)" />
                <Text fw={800} fz="xl" c="var(--app-text)">
                  Recommended Freelancers
                </Text>
              </Group>
              <Text c="dimmed" fz="sm">
                Select a project and get graph-ranked freelancers and team options automatically.
              </Text>
            </Stack>
            <Badge color="violet" variant="light">
              RecSys + KBS
            </Badge>
          </Group>

          {projectOptions.length > 0 ? (
            <Select
              label="Project"
              placeholder="Choose a project"
              data={projectOptions}
              value={selectedProjectId}
              onChange={setSelectedProjectId}
              radius="md"
            />
          ) : (
            <Card withBorder radius="md" bg="var(--app-bg)" py="lg">
              <Text ta="center" c="dimmed" fz="sm">
                Create an open project to see freelancer recommendations.
              </Text>
            </Card>
          )}

          {selectedProject && requiredRoles.length > 0 && (
            <Group gap="xs" wrap="wrap">
              {requiredRoles.map((role) => (
                <Badge key={role.name} color="teal" variant="light">
                  {role.count}x {role.name}
                </Badge>
              ))}
            </Group>
          )}

          {recommendationsLoading ? (
            <Center py="xl">
              <Stack align="center" gap="xs">
                <Loader color="violet" />
                <Text fz="sm" c="dimmed">
                  Syncing the graph and ranking candidates...
                </Text>
              </Stack>
            </Center>
          ) : recommendationsError ? (
            <Text c="orange" fz="sm">
              {recommendationsError}. Your projects are still available below.
            </Text>
          ) : selectedProjectId && freelancerRecommendations.length === 0 ? (
            <Text c="dimmed" fz="sm">
              No synced freelancers match this project yet.
            </Text>
          ) : freelancerRecommendations.length > 0 ? (
            <SimpleGrid cols={{ base: 1, lg: 2 }}>
              {freelancerRecommendations.slice(0, 4).map((item) => (
                <Card key={item.freelancer.id} withBorder radius="md" bg="var(--app-bg)">
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start">
                      <Group gap="sm">
                        <Avatar size={44} radius="xl" color="violet" src={item.freelancer.avatar || undefined}>
                          <User size={22} />
                        </Avatar>
                        <Stack gap={2}>
                          <Text fw={700} c="var(--app-text)">
                            {item.freelancer.name}
                          </Text>
                          <Text fz="sm" c="dimmed" lineClamp={1}>
                            {item.freelancer.headline || item.bestRole || "Freelancer"}
                          </Text>
                        </Stack>
                      </Group>
                      <Badge color="violet" variant="filled">
                        {item.score}% match
                      </Badge>
                    </Group>
                    <KbsExplanationPanel
                      score={item.score}
                      reason={item.reason}
                      matchedSkills={item.matchedSkills}
                      missingSkills={item.missingSkills}
                      scoreBreakdown={item.scoreBreakdown}
                      evidence={item.evidence}
                      evidenceFacts={item.evidenceFacts}
                      llmEvaluation={item.llmEvaluation}
                      graphPath="Project graph evidence: REQUIRES_SKILL/ROLE plus freelancer skills, role, experience, projects, certifications, publications"
                    />
                    <Group gap="xs" wrap="wrap">
                      {item.freelancer.skills.slice(0, 5).map((skill: string) => (
                        <Badge key={skill} size="sm" color="cyan" variant="light">
                          {skill}
                        </Badge>
                      ))}
                    </Group>
                    <Group gap="xs">
                      {item.freelancer.hourlyRate && (
                        <Badge size="sm" color="green" variant="light">
                          ${item.freelancer.hourlyRate}/hr
                        </Badge>
                      )}
                      {item.bestRole && (
                        <Badge size="sm" color="violet" variant="light">
                          {item.bestRole}
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          ) : null}

          {teamRecommendations.length > 0 && (
            <Stack gap="sm">
              <Divider />
              <Group gap="xs">
                <Users size={18} color="var(--mantine-color-teal-6)" />
                <Text fw={700} c="var(--app-text)">
                  Suggested Teams
                </Text>
              </Group>
              {teamRecommendations.map((team, index) => (
                <Card key={`${team.finalScore}-${index}`} withBorder radius="md" bg="var(--app-bg)">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Text fw={700} c="var(--app-text)">
                        Team Option {index + 1}
                      </Text>
                      <Group gap="xs">
                        <Badge color="teal" variant="light">
                          Final {team.finalScore}
                        </Badge>
                        <Badge color="cyan" variant="light">
                          {team.coverageScore}% coverage
                        </Badge>
                      </Group>
                    </Group>
                    <KbsExplanationPanel
                      score={team.finalScore}
                      reason={team.reason}
                      matchedSkills={team.coveredSkills}
                      missingSkills={team.missingSkills}
                      scoreBreakdown={team.scoreBreakdown}
                      evidence={{ evidenceSkills: team.evidenceSkills }}
                      graphPath="Team graph evidence: combined skill coverage, complementary roles, CV project evidence, experience, shared graph context"
                      color="teal"
                    />
                    <Group gap="xs" wrap="wrap">
                      {team.members.map((member) => (
                        <Badge key={member.userId} color="teal" variant="light">
                          {member.name}: {member.coveredSkills.slice(0, 2).join(", ")}
                        </Badge>
                      ))}
                    </Group>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

      {/* Recent Projects */}
      <Text fw={600} fz="lg" c="var(--app-text)" mb="md">
        Recent Projects
      </Text>

      {loading ? (
        <Box ta="center" py="xl">
          <Loader size="md" />
        </Box>
      ) : recentProjects.length === 0 ? (
        <Card withBorder radius="md" bg="var(--app-surface)" py="xl">
          <Text ta="center" c="dimmed">
            No projects yet.{" "}
            <Button
              component={Link}
              href="/client/projects/new"
              variant="subtle"
              color="teal"
              size="sm"
              px={0}
            >
              Create your first project
            </Button>
          </Text>
        </Card>
      ) : (
        <Stack gap="md">
          {recentProjects.map((project) => (
            <Card
              key={project.id}
              withBorder
              radius="md"
              bg="var(--app-surface)"
              component={Link}
              href={`/client/projects/${project.id}`}
              style={{ textDecoration: "none" }}
            >
              <Group justify="space-between" align="flex-start" mb="xs">
                <Box>
                  <Text fw={600} c="var(--app-text)" fz="md">
                    {project.title}
                  </Text>
                  <Text c="dimmed" fz="sm" lineClamp={1} mt={2}>
                    {project.description}
                  </Text>
                </Box>
                <StatusBadge status={project.status} />
              </Group>
              <Group gap="xs">
                <Badge variant="light" color="cyan" size="xs">
                  Budget: ${project.budget.toLocaleString()}
                </Badge>
                <Badge variant="light" color="indigo" size="xs">
                  {project.proposalsCount} proposals
                </Badge>
              </Group>
              <Box mt="sm">
                <SkillsTags skills={project.skills} />
              </Box>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
