"use client";

import { useCallback, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Button,
  Card,
  Modal,
  Stack,
  Text,
  Group,
  Badge,
  Loader,
  Divider,
  SimpleGrid,
  Avatar,
  Anchor,
  Center,
  Progress,
  ThemeIcon,
  Tabs,
  TextInput,
  Textarea,
  NumberInput,
  TagsInput,
} from "@mantine/core";
import {
  ArrowLeft,
  ArrowUpRight,
  Users,
  XCircle,
  DollarSign,
  Calendar,
  Check,
  X,
  User,
  FileText,
  Sparkles,
  Mail,
  ShieldCheck,
  Pencil,
  Save,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/client/PageHeader";
import { StatusBadge } from "@/components/client/StatusBadge";
import { SkillsTags } from "@/components/client/SkillsTags";
import { ConfirmModal } from "@/components/client/ConfirmModal";
import { projectApi, proposalApi, recApi, type ProjectData, type ProposalData } from "@/lib/api";
import { KbsExplanationPanel } from "@/components/kbs/KbsExplanationPanel";
import { notifications } from "@mantine/notifications";

type FreelancerRecommendation = Awaited<
  ReturnType<typeof recApi.freelancers>
>["recommendations"][number];
type TeamRecommendation = Awaited<ReturnType<typeof recApi.team>>["recommendations"][number];

function clampScore(value: number) {
  return Math.min(100, Math.max(0, value));
}

type EditProjectForm = {
  title: string;
  description: string;
  budget: number | "";
  timeline: string;
  skills: string[];
};

const SKILL_OPTIONS = [
  "React",
  "Next.js",
  "Node.js",
  "TypeScript",
  "UI Design",
  "Figma",
  "Python",
  "Data Analysis",
  "Content Writing",
  "Mobile Design",
  "Stripe",
  "MongoDB",
  "PostgreSQL",
  "AWS",
  "DevOps",
  "Machine Learning",
  "D3.js",
  "Tailwind",
  "REST API",
  "Webhooks",
];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closing, setClosing] = useState(false);
  const [editOpened, setEditOpened] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [recommendationVersion, setRecommendationVersion] = useState(0);
  const [editForm, setEditForm] = useState<EditProjectForm>({
    title: "",
    description: "",
    budget: "",
    timeline: "",
    skills: [],
  });
  const [freelancerRecommendations, setFreelancerRecommendations] = useState<FreelancerRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [teamRecommendations, setTeamRecommendations] = useState<TeamRecommendation[]>([]);
  const [requiredRoles, setRequiredRoles] = useState<{ name: string; count: number }[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  const [actionTarget, setActionTarget] = useState<{
    proposalId: string;
    action: "accept" | "reject";
  } | null>(null);
  const [acting, setActing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [projectData, proposalsData] = await Promise.all([
        projectApi.get(id),
        proposalApi.list({ projectId: id }),
      ]);
      setProject(projectData.project);
      setProposals(proposalsData.proposals);
    } catch {
      setProject(null);
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(fetchData);
  }, [fetchData]);

  const projectId = project?.id;

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      queueMicrotask(() => {
        if (cancelled) return;
        setFreelancerRecommendations([]);
        setRecommendationsError(null);
      });
      return;
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setRecommendationsLoading(true);
      recApi
        .freelancers(projectId, { limit: 8 })
        .then((data) => {
          if (cancelled) return;
          setFreelancerRecommendations(data.recommendations);
          setRecommendationsError(null);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setFreelancerRecommendations([]);
          setRecommendationsError(error instanceof Error ? error.message : "KBS recommendations unavailable");
        })
        .finally(() => {
          if (!cancelled) setRecommendationsLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [projectId, recommendationVersion]);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      queueMicrotask(() => {
        if (cancelled) return;
        setTeamRecommendations([]);
        setRequiredRoles([]);
        setTeamsError(null);
      });
      return;
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setTeamsLoading(true);
      recApi
        .team(projectId, { limit: 3, maxTeamSize: 4 })
        .then((data) => {
          if (cancelled) return;
          setTeamRecommendations(data.recommendations);
          setRequiredRoles(data.requiredRoles || []);
          setTeamsError(null);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setTeamRecommendations([]);
          setRequiredRoles([]);
          setTeamsError(error instanceof Error ? error.message : "KBS team recommendations unavailable");
        })
        .finally(() => {
          if (!cancelled) setTeamsLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [projectId, recommendationVersion]);

  const openEditModal = () => {
    if (!project) return;

    setEditForm({
      title: project.title,
      description: project.description,
      budget: project.budget,
      timeline: project.timeline || "",
      skills: project.skills || [],
    });
    setEditOpened(true);
  };

  const handleEditSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!project) return;

    const title = editForm.title.trim();
    const description = editForm.description.trim();
    const skills = editForm.skills.map((skill) => skill.trim()).filter(Boolean);

    if (!title || !description || !editForm.budget || skills.length === 0) {
      notifications.show({
        title: "Missing project details",
        message: "Add a title, description, budget, and at least one required skill.",
        color: "orange",
      });
      return;
    }

    setSavingEdit(true);
    try {
      const result = await projectApi.update(project.id, {
        title,
        description,
        budget: Number(editForm.budget),
        skills,
        timeline: editForm.timeline.trim() || undefined,
      });

      setProject((current) => ({
        ...(current || project),
        ...result.project,
        proposalsCount: current?.proposalsCount || project.proposalsCount,
      }));
      setRecommendationVersion((current) => current + 1);
      setEditOpened(false);
      notifications.show({
        title: "Project updated",
        message: "Your job details were saved and recommendations are refreshing.",
        color: "green",
      });
    } catch (error: unknown) {
      notifications.show({
        title: "Update failed",
        message: error instanceof Error ? error.message : "Failed to update project.",
        color: "red",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleClose = async () => {
    if (!project) return;
    setClosing(true);
    try {
      await projectApi.update(project.id, { status: "closed" });
      notifications.show({
        title: "Project closed",
        message: "No new proposals will be accepted.",
        color: "green",
      });
      fetchData();
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to close project.",
        color: "red",
      });
    } finally {
      setClosing(false);
      setShowCloseModal(false);
    }
  };

  const handleAction = async () => {
    if (!actionTarget) return;
    setActing(true);
    try {
      await proposalApi.update({
        proposalId: actionTarget.proposalId,
        status: actionTarget.action === "accept" ? "accepted" : "rejected",
      });
      notifications.show({
        title: "Updated",
        message:
          actionTarget.action === "accept"
            ? "Proposal accepted. Freelancer notified."
            : "Proposal rejected.",
        color: actionTarget.action === "accept" ? "green" : "orange",
      });
      fetchData();
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to update proposal.",
        color: "red",
      });
    } finally {
      setActionTarget(null);
      setActing(false);
    }
  };

  if (loading) {
    return (
      <Box ta="center" py="xl">
        <Loader size="md" />
      </Box>
    );
  }

  if (!project) {
    return (
      <Box>
        <Button
          component={Link}
          href="/client/projects"
          variant="subtle"
          leftSection={<ArrowLeft size={16} />}
          mb="lg"
        >
          Back to projects
        </Button>
        <Card withBorder radius="md" bg="var(--app-surface)" py="xl">
          <Text ta="center" c="dimmed">
            Project not found.
          </Text>
        </Card>
      </Box>
    );
  }

  const pendingProposals = proposals.filter((p) => p.status === "pending");
  const acceptedProposals = proposals.filter((p) => p.status === "accepted");
  const rejectedProposals = proposals.filter((p) => p.status === "rejected");
  const editSkillOptions = Array.from(new Set([...SKILL_OPTIONS, ...editForm.skills]));

  return (
    <Box>
      <Group mb="lg">
        <Button
          component={Link}
          href="/client/projects"
          variant="subtle"
          leftSection={<ArrowLeft size={16} />}
          size="sm"
        >
          Back to projects
        </Button>
      </Group>

      {/* Project Header */}
      <PageHeader
        title={project.title}
        actions={
          <Group gap="sm">
            <Button
              leftSection={<Pencil size={16} />}
              variant="light"
              color="teal"
              onClick={openEditModal}
            >
              Edit Job
            </Button>
            {project.status === "open" && (
              <Button
                leftSection={<XCircle size={16} />}
                variant="light"
                color="red"
                onClick={() => setShowCloseModal(true)}
              >
                Close Project
              </Button>
            )}
          </Group>
        }
      />

      {/* Project Details Card */}
      <Card withBorder radius="md" bg="var(--app-surface)" mb="xl">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Group gap="xs">
              <StatusBadge status={project.status} />
              <Badge variant="light" color="cyan" size="sm">
                <Group gap={4}>
                  <DollarSign size={12} />
                  ${project.budget.toLocaleString()}
                </Group>
              </Badge>
              {project.timeline && (
                <Badge variant="light" color="gray" size="sm">
                  <Group gap={4}>
                    <Calendar size={12} />
                    {project.timeline}
                  </Group>
                </Badge>
              )}
            </Group>
            <Text fz="sm" c="dimmed">
              Created {new Date(project.createdAt).toLocaleDateString()}
            </Text>
          </Group>

          <Text c="var(--app-text)" fz="sm" style={{ lineHeight: 1.7 }}>
            {project.description}
          </Text>

          <Box>
            <Text fw={600} fz="sm" c="var(--app-text)" mb="xs">
              Required Skills
            </Text>
            <SkillsTags skills={project.skills} />
          </Box>
        </Stack>
      </Card>

      <Tabs
        defaultValue="individual"
        color="teal"
        radius="lg"
        mb="xl"
        styles={{
          list: {
            border: 0,
            gap: 8,
          },
          tab: {
            borderRadius: 14,
            border: "1px solid var(--app-border)",
            fontWeight: 800,
            padding: "12px 16px",
          },
        }}
      >
        <Card
          withBorder
          radius="xl"
          p="md"
          mb="md"
          style={{
            background:
              "linear-gradient(135deg, rgba(20,184,166,0.10), rgba(139,92,246,0.08), var(--app-surface))",
          }}
        >
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Box>
                <Text fw={900} fz="lg" c="var(--app-text)">
                  Recommended hiring paths
                </Text>
                <Text fz="sm" c="dimmed">
                  Compare the best individual freelancers against a generated team option.
                </Text>
              </Box>
              <Badge color="teal" variant="light" size="lg">
                KBS + RecSys
              </Badge>
            </Group>
            <Tabs.List grow>
              <Tabs.Tab value="individual" leftSection={<User size={16} />}>
                <Group gap={8} justify="center" wrap="nowrap">
                  <Text fz="sm" fw={800}>Individual Freelancers</Text>
                  <Badge size="xs" color="violet" variant="filled" radius="xl">
                    {freelancerRecommendations.length}
                  </Badge>
                </Group>
              </Tabs.Tab>
              <Tabs.Tab value="team" leftSection={<Users size={16} />}>
                <Group gap={8} justify="center" wrap="nowrap">
                  <Text fz="sm" fw={800}>Best Team</Text>
                  <Badge size="xs" color="teal" variant="filled" radius="xl">
                    {teamRecommendations.length}
                  </Badge>
                </Group>
              </Tabs.Tab>
            </Tabs.List>
          </Stack>
        </Card>

        <Tabs.Panel value="individual" pt="md">
      {/* Recommended Freelancers */}
      <Card withBorder radius="xl" bg="var(--app-surface)" mb="xl" p={{ base: "md", md: "xl" }}>
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <Sparkles size={18} color="var(--mantine-color-violet-6)" />
              <Text fw={700} fz="lg" c="var(--app-text)">
                Recommended Freelancers
              </Text>
            </Group>
            <Badge color="violet" variant="light">
              KBS Match
            </Badge>
          </Group>

          {requiredRoles.length > 0 && (
            <Group gap="xs" wrap="wrap">
              {requiredRoles.map((role) => (
                <Badge key={role.name} color="teal" variant="light">
                  {role.count}x {role.name}
                </Badge>
              ))}
            </Group>
          )}

          {recommendationsLoading ? (
            <Center py="md">
              <Loader size="sm" color="violet" />
            </Center>
          ) : recommendationsError ? (
            <Text fz="sm" c="orange">
              {recommendationsError}
            </Text>
          ) : freelancerRecommendations.length === 0 ? (
            <Text fz="sm" c="dimmed">
              No synced freelancers match this project yet.
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
              {freelancerRecommendations.map((item) => (
                <Card
                  key={item.freelancer.id}
                  withBorder
                  radius="xl"
                  p="lg"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(139,92,246,0.10), rgba(6,182,212,0.08), var(--app-surface))",
                  }}
                >
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Group gap="sm" align="flex-start" wrap="nowrap" style={{ minWidth: 0 }}>
                        <Avatar size={60} radius="xl" color="violet" src={item.freelancer.avatar || undefined}>
                          <User size={28} />
                        </Avatar>
                        <Stack gap={4} style={{ minWidth: 0 }}>
                          <Group gap="xs" wrap="wrap">
                            <Badge color="violet" variant="filled" radius="md">
                              {clampScore(item.score)}% individual match
                            </Badge>
                            {item.freelancer.hourlyRate !== undefined && (
                              <Badge color="green" variant="light" radius="md">
                                ${item.freelancer.hourlyRate}/hr
                              </Badge>
                            )}
                          </Group>
                          <Text fw={900} c="var(--app-text)" lineClamp={1}>
                            {item.freelancer.name}
                          </Text>
                          <Text fz="sm" c="dimmed" lineClamp={1}>
                            {item.freelancer.headline || item.bestRole || "Freelance specialist"}
                          </Text>
                        </Stack>
                      </Group>
                    </Group>
                    <Progress value={clampScore(item.score)} color={item.score >= 80 ? "green" : "violet"} radius="xl" />
                    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
                      <Card withBorder radius="lg" p="sm" bg="rgba(255,255,255,0.48)">
                        <Text fz="xs" c="dimmed" tt="uppercase" fw={800}>Match</Text>
                        <Text fw={900} fz="xl" c="var(--app-text)">{clampScore(item.score)}%</Text>
                        <Text fz="xs" c="dimmed">Individual fit</Text>
                      </Card>
                      <Card withBorder radius="lg" p="sm" bg="rgba(255,255,255,0.48)">
                        <Text fz="xs" c="dimmed" tt="uppercase" fw={800}>Rate</Text>
                        <Text fw={900} fz="xl" c="var(--app-text)">
                          {item.freelancer.hourlyRate !== undefined ? `$${item.freelancer.hourlyRate}/hr` : "Open"}
                        </Text>
                        <Text fz="xs" c="dimmed">Candidate pricing</Text>
                      </Card>
                      <Card withBorder radius="lg" p="sm" bg="rgba(255,255,255,0.48)">
                        <Text fz="xs" c="dimmed" tt="uppercase" fw={800}>Covered</Text>
                        <Text fw={900} fz="xl" c="var(--app-text)">{item.matchedSkills.length}</Text>
                        <Text fz="xs" c="dimmed">Required skills</Text>
                      </Card>
                    </SimpleGrid>
                    <KbsExplanationPanel
                      score={item.score}
                      reason={item.reason}
                      matchedSkills={item.matchedSkills}
                      missingSkills={item.missingSkills}
                      scoreBreakdown={item.scoreBreakdown}
                      evidence={item.evidence}
                      experienceDetails={item.experienceDetails}
                      relevantExperienceDetails={item.relevantExperienceDetails}
                      projectEvidenceDetails={item.projectEvidenceDetails}
                      graphPath="Project - REQUIRES_SKILL -> Skill <- HAS_SKILL - Freelancer"
                    />
                    <Group gap="xs" wrap="wrap">
                      {item.freelancer.experienceLevel && (
                        <Badge size="sm" color="gray" variant="light" radius="xl">
                          {item.freelancer.experienceLevel}
                        </Badge>
                      )}
                      {item.bestRole && (
                        <Badge size="sm" color="violet" variant="light" radius="xl">
                          {item.bestRole}
                        </Badge>
                      )}
                      {item.freelancer.skills.slice(0, 5).map((skill) => (
                        <Badge key={skill} size="sm" color="cyan" variant="light" radius="xl">
                          {skill}
                        </Badge>
                      ))}
                    </Group>
                    <Group grow gap="xs">
                      <Button
                        component={Link}
                        href={`/client/freelancers/${item.freelancer.id}`}
                        variant="light"
                        color="gray"
                        rightSection={<ArrowUpRight size={15} />}
                      >
                        View Profile
                      </Button>
                      <Button
                        component={Link}
                        href={`/client/messages?with=${item.freelancer.id}`}
                        color="violet"
                        leftSection={<Mail size={15} />}
                      >
                        Message
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )}
        </Stack>
      </Card>
        </Tabs.Panel>

        <Tabs.Panel value="team" pt="md">
      {/* Recommended Teams */}
      <Card withBorder radius="md" bg="var(--app-surface)" mb="xl">
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="xs">
              <Users size={18} color="var(--mantine-color-teal-6)" />
              <Text fw={700} fz="lg" c="var(--app-text)">
                Recommended Teams
              </Text>
            </Group>
            <Badge color="teal" variant="light">
              Dynamic Skill Coverage
            </Badge>
          </Group>

          {teamsLoading ? (
            <Center py="md">
              <Loader size="sm" color="teal" />
            </Center>
          ) : teamsError ? (
            <Text fz="sm" c="orange">
              {teamsError}
            </Text>
          ) : teamRecommendations.length === 0 ? (
            <Text fz="sm" c="dimmed">
              No team can cover this project yet.
            </Text>
          ) : (
            <Stack gap="md">
              {teamRecommendations.map((team, index) => {
                const estimatedHourlyTotal = team.members.reduce(
                  (total, member) => total + (member.hourlyRate || 0),
                  0
                );

                return (
                  <Card
                    key={`${team.score}-${index}`}
                    withBorder
                    radius="xl"
                    p={{ base: "md", md: "xl" }}
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(20,184,166,0.10), rgba(59,130,246,0.08) 45%, var(--app-surface) 100%)",
                      overflow: "hidden",
                    }}
                  >
                    <Stack gap="lg">
                      <Group justify="space-between" align="flex-start">
                        <Group gap="md" align="flex-start">
                          <ThemeIcon size={48} radius="xl" color="teal" variant="light">
                            <Users size={24} />
                          </ThemeIcon>
                          <Stack gap={4}>
                            <Text fw={900} fz="xl" c="var(--app-text)">
                              Team Option {index + 1}
                            </Text>
                            <Text fz="sm" c="dimmed">
                              {team.members.length} recommended specialists covering {team.coveredSkills.length} of {project.skills.length || team.coveredSkills.length} required skills.
                            </Text>
                          </Stack>
                        </Group>

                        <Group gap="xs" justify="flex-end">
                          <Badge color="teal" variant="filled" size="lg">
                            {clampScore(team.coverageScore)}% team match
                          </Badge>
                          <Badge color="cyan" variant="light" size="lg">
                            {team.coverageScore}% coverage
                          </Badge>
                          {estimatedHourlyTotal > 0 && (
                            <Badge color="green" variant="light" size="lg">
                              ${estimatedHourlyTotal}/hr team
                            </Badge>
                          )}
                        </Group>
                      </Group>

                      <SimpleGrid cols={{ base: 1, md: 4 }} spacing="sm">
                        <Card withBorder radius="lg" p="md" bg="rgba(255,255,255,0.45)">
                          <Text fz="xs" c="dimmed" tt="uppercase" fw={800}>Skill Coverage</Text>
                          <Text fw={900} fz="xl" c="var(--app-text)">{team.coverageScore}%</Text>
                          <Progress value={team.coverageScore} color="teal" radius="xl" mt="xs" />
                        </Card>
                        <Card withBorder radius="lg" p="md" bg="rgba(255,255,255,0.45)">
                          <Text fz="xs" c="dimmed" tt="uppercase" fw={800}>Tech Role Score</Text>
                          <Text fw={900} fz="xl" c="var(--app-text)">{team.technicalScore}</Text>
                          <Text fz="xs" c="dimmed">RecSys tech score</Text>
                        </Card>
                        <Card withBorder radius="lg" p="md" bg="rgba(255,255,255,0.45)">
                          <Text fz="xs" c="dimmed" tt="uppercase" fw={800}>Knowledge Score</Text>
                          <Text fw={900} fz="xl" c="var(--app-text)">{team.knowledgeScore ?? 0}</Text>
                          <Text fz="xs" c="dimmed">Skill/domain keyword hits</Text>
                        </Card>
                        <Card withBorder radius="lg" p="md" bg="rgba(255,255,255,0.45)">
                          <Text fz="xs" c="dimmed" tt="uppercase" fw={800}>Skill Synergy</Text>
                          <Text fw={900} fz="xl" c="var(--app-text)">{team.synergyScore}</Text>
                          <Text fz="xs" c="dimmed">Shared skills between members</Text>
                        </Card>
                      </SimpleGrid>

                      <KbsExplanationPanel
                        score={team.coverageScore}
                        reason={team.reason}
                        matchedSkills={team.coveredSkills}
                        missingSkills={team.missingSkills}
                        scoreBreakdown={{
                          techScore: team.technicalScore,
                          synergyScore: team.synergyScore,
                          knowledgeScore: team.knowledgeScore,
                          rawFinalScore: team.rawFinalScore,
                          finalScore: team.finalScore,
                        }}
                        graphPath="Project skills are covered by multiple Freelancer - HAS_SKILL relationships"
                        color="teal"
                      />

                      {team.sharedEntities.length > 0 && (
                        <Group gap="xs" wrap="wrap">
                          <Badge color="grape" variant="light" leftSection={<ShieldCheck size={12} />}>
                            Shared evidence
                          </Badge>
                          {team.sharedEntities.slice(0, 6).map((entity) => (
                            <Badge key={entity} size="sm" color="grape" variant="light">
                              {entity}
                            </Badge>
                          ))}
                          {team.sharedEntities.length > 6 && (
                            <Badge size="sm" color="gray" variant="light">
                              +{team.sharedEntities.length - 6} more
                            </Badge>
                          )}
                        </Group>
                      )}

                      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                        {team.members.map((member) => (
                          <Card key={member.userId} withBorder radius="lg" p="md" bg="var(--app-surface)">
                            <Stack gap="md">
                              <Group justify="space-between" align="flex-start" wrap="nowrap">
                                <Group gap="sm" align="flex-start" wrap="nowrap" style={{ minWidth: 0 }}>
                                  <Avatar size={54} radius="xl" color="teal">
                                    <User size={26} />
                                  </Avatar>
                                  <Stack gap={3} style={{ minWidth: 0 }}>
                                    <Text fw={800} c="var(--app-text)" lineClamp={1}>
                                      {member.name}
                                    </Text>
                                    <Text fz="sm" c="dimmed" lineClamp={1}>
                                      {member.headline || member.bestRole || "Freelance specialist"}
                                    </Text>
                                    <Group gap={6} wrap="wrap">
                                      {member.bestRole && (
                                        <Badge size="xs" color="violet" variant="light">
                                          {member.bestRole}
                                        </Badge>
                                      )}
                                      {member.bestRoleScore !== undefined && (
                                        <Badge size="xs" color="teal" variant="light">
                                          {member.bestRoleScore}% role fit
                                        </Badge>
                                      )}
                                    </Group>
                                  </Stack>
                                </Group>
                                {member.hourlyRate !== undefined && (
                                  <Badge size="md" color="green" variant="light" style={{ flexShrink: 0 }}>
                                    ${member.hourlyRate}/hr
                                  </Badge>
                                )}
                              </Group>

                              <Box>
                                <Text fz="xs" c="dimmed" tt="uppercase" fw={800} mb={6}>
                                  Covers in this team
                                </Text>
                                <Group gap={6} wrap="wrap">
                                  {member.coveredSkills.length > 0 ? (
                                    member.coveredSkills.map((skill) => (
                                      <Badge key={skill} size="sm" color="teal" variant="light">
                                        {skill}
                                      </Badge>
                                    ))
                                  ) : (
                                    <Text fz="sm" c="dimmed">No direct skill coverage recorded.</Text>
                                  )}
                                </Group>
                              </Box>

                              <Group grow gap="xs">
                                <Button
                                  component={Link}
                                  href={`/client/freelancers/${member.userId}`}
                                  variant="light"
                                  color="gray"
                                  rightSection={<ArrowUpRight size={15} />}
                                >
                                  View Profile
                                </Button>
                                <Button
                                  component={Link}
                                  href={`/client/messages?with=${member.userId}`}
                                  color="teal"
                                  leftSection={<Mail size={15} />}
                                >
                                  Message
                                </Button>
                              </Group>
                            </Stack>
                          </Card>
                        ))}
                      </SimpleGrid>
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Card>
        </Tabs.Panel>
      </Tabs>

      {/* Proposals Section */}
      <Box>
        <Group mb="md">
          <Group gap="xs">
            <Users size={18} color="#4f46e5" />
            <Text fw={700} fz="lg" c="var(--app-text)">
              Proposals
            </Text>
          </Group>
          <Badge variant="light" color="indigo" size="sm">
            {proposals.length} total · {pendingProposals.length} pending
          </Badge>
        </Group>

        {proposals.length === 0 ? (
          <Card withBorder radius="md" bg="var(--app-surface)" py="xl">
            <Text ta="center" c="dimmed">
              No proposals yet for this project.
            </Text>
          </Card>
        ) : (
          <Stack gap="xl">
            {pendingProposals.length > 0 && (
              <Box>
                <Text fw={600} c="var(--app-text)" mb="md">
                  Pending ({pendingProposals.length})
                </Text>
                <SimpleGrid cols={{ base: 1, lg: 2 }}>
                  {pendingProposals.map((proposal) => (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      onAccept={() =>
                        setActionTarget({ proposalId: proposal.id, action: "accept" })
                      }
                      onReject={() =>
                        setActionTarget({ proposalId: proposal.id, action: "reject" })
                      }
                    />
                  ))}
                </SimpleGrid>
              </Box>
            )}

            {acceptedProposals.length > 0 && (
              <Box>
                <Divider mb="md" />
                <Text fw={600} c="var(--app-text)" mb="md">
                  Accepted ({acceptedProposals.length})
                </Text>
                <SimpleGrid cols={{ base: 1, lg: 2 }}>
                  {acceptedProposals.map((proposal) => (
                    <ProposalCard key={proposal.id} proposal={proposal} readonly />
                  ))}
                </SimpleGrid>
              </Box>
            )}

            {rejectedProposals.length > 0 && (
              <Box>
                <Divider mb="md" />
                <Text fw={600} c="var(--app-text)" mb="md">
                  Rejected ({rejectedProposals.length})
                </Text>
                <SimpleGrid cols={{ base: 1, lg: 2 }}>
                  {rejectedProposals.map((proposal) => (
                    <ProposalCard key={proposal.id} proposal={proposal} readonly />
                  ))}
                </SimpleGrid>
              </Box>
            )}
          </Stack>
        )}
      </Box>

      <Modal
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        title="Edit Job"
        size="lg"
        radius="lg"
        centered
      >
        <form onSubmit={handleEditSubmit}>
          <Stack gap="md">
            <TextInput
              label="Project Title"
              required
              value={editForm.title}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, title: event.currentTarget.value }))
              }
            />
            <Textarea
              label="Description"
              required
              autosize
              minRows={8}
              maxRows={18}
              value={editForm.description}
              onChange={(event) =>
                setEditForm((current) => ({ ...current, description: event.currentTarget.value }))
              }
            />
            <Group grow align="flex-start">
              <NumberInput
                label="Budget (USD)"
                required
                min={1}
                prefix="$"
                value={editForm.budget}
                onChange={(value) =>
                  setEditForm((current) => ({
                    ...current,
                    budget: typeof value === "number" ? value : "",
                  }))
                }
              />
              <TextInput
                label="Timeline / Duration"
                placeholder="e.g. 4 weeks"
                value={editForm.timeline}
                onChange={(event) =>
                  setEditForm((current) => ({ ...current, timeline: event.currentTarget.value }))
                }
              />
            </Group>
            <TagsInput
              label="Required Skills"
              required
              clearable
              data={editSkillOptions}
              value={editForm.skills}
              onChange={(skills) => setEditForm((current) => ({ ...current, skills }))}
            />
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setEditOpened(false)} disabled={savingEdit}>
                Cancel
              </Button>
              <Button type="submit" color="teal" loading={savingEdit} leftSection={<Save size={16} />}>
                Save Changes
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Confirm Close Modal */}
      <ConfirmModal
        opened={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        onConfirm={handleClose}
        title="Close Project"
        description={`Are you sure you want to close "${project.title}"? No new proposals will be accepted.`}
        confirmLabel="Close Project"
        confirmColor="red"
        loading={closing}
      />

      {/* Confirm Accept/Reject Modal */}
      <ConfirmModal
        opened={!!actionTarget}
        onClose={() => setActionTarget(null)}
        onConfirm={handleAction}
        title={
          actionTarget?.action === "accept" ? "Accept Proposal" : "Reject Proposal"
        }
        description={
          actionTarget?.action === "accept"
            ? "Accept this proposal? The freelancer will be notified and the project will move to in-progress."
            : "Are you sure you want to reject this proposal?"
        }
        confirmLabel={actionTarget?.action === "accept" ? "Accept" : "Reject"}
        confirmColor={actionTarget?.action === "accept" ? "green" : "red"}
        loading={acting}
      />
    </Box>
  );
}

function ProposalCard({
  proposal,
  onAccept,
  onReject,
  readonly,
}: {
  proposal: ProposalData;
  onAccept?: () => void;
  onReject?: () => void;
  readonly?: boolean;
}) {
  return (
    <Card withBorder radius="md" bg="var(--app-surface)">
      <Stack gap="md">
        <Group align="flex-start">
          <Avatar size={48} radius="xl" color="cyan">
            <User size={24} />
          </Avatar>
          <Stack gap={2} style={{ flex: 1 }}>
            <Group gap="xs">
              <Text fw={600} c="var(--app-text)">
                {proposal.freelancerName || "Freelancer"}
              </Text>
              {proposal.status !== "pending" && (
                <StatusBadge
                  status={proposal.status === "accepted" ? "open" : "closed"}
                />
              )}
            </Group>
          </Stack>
        </Group>

        <Text c="var(--app-text)" fz="sm" style={{ lineHeight: 1.6 }}>
          {proposal.coverLetter}
        </Text>

        <Group gap="xs">
          <Badge variant="light" color="cyan" size="sm">
            <Group gap={4}>
              <DollarSign size={12} />${proposal.proposedRate.toLocaleString()}
            </Group>
          </Badge>
          <Badge variant="light" color="gray" size="sm">
            <Group gap={4}>
              <Calendar size={12} />
              {new Date(proposal.submittedAt).toLocaleDateString()}
            </Group>
          </Badge>
          {proposal.status === "accepted" && (
            <Badge variant="filled" color="green" size="sm">
              <Group gap={4}>
                <Check size={12} /> Accepted
              </Group>
            </Badge>
          )}
          {proposal.status === "rejected" && (
            <Badge variant="filled" color="red" size="sm">
              <Group gap={4}>
                <X size={12} /> Rejected
              </Group>
            </Badge>
          )}
        </Group>

        {proposal.portfolioFileUrl && (
          <Anchor
            href={proposal.portfolioFileUrl}
            target="_blank"
            rel="noreferrer"
            fz="sm"
            c="cyan"
            underline="hover"
          >
            <Group gap={6}>
              <FileText size={14} />
              {proposal.portfolioFileName || "Portfolio PDF"}
            </Group>
          </Anchor>
        )}

        {!readonly && (
          <Group gap="sm" mt="xs">
            <Button
              size="sm"
              variant="light"
              color="green"
              leftSection={<Check size={16} />}
              onClick={onAccept}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="light"
              color="red"
              leftSection={<X size={16} />}
              onClick={onReject}
            >
              Reject
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
