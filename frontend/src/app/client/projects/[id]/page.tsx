"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Button,
  Card,
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
} from "@mantine/core";
import {
  ArrowLeft,
  Users,
  XCircle,
  DollarSign,
  Calendar,
  Check,
  X,
  User,
  FileText,
  Sparkles,
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

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closing, setClosing] = useState(false);
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

  const fetchData = async () => {
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
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!project) {
      setFreelancerRecommendations([]);
      setRecommendationsError(null);
      return;
    }

    setRecommendationsLoading(true);
    recApi
      .freelancers(project.id, { limit: 8 })
      .then((data) => {
        setFreelancerRecommendations(data.recommendations);
        setRecommendationsError(null);
      })
      .catch((error) => {
        setFreelancerRecommendations([]);
        setRecommendationsError(error instanceof Error ? error.message : "KBS recommendations unavailable");
      })
      .finally(() => setRecommendationsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  useEffect(() => {
    if (!project) {
      setTeamRecommendations([]);
      setRequiredRoles([]);
      setTeamsError(null);
      return;
    }

    setTeamsLoading(true);
    recApi
      .team(project.id, { limit: 3, maxTeamSize: 4 })
      .then((data) => {
        setTeamRecommendations(data.recommendations);
        setRequiredRoles(data.requiredRoles || []);
        setTeamsError(null);
      })
      .catch((error) => {
        setTeamRecommendations([]);
        setRequiredRoles([]);
        setTeamsError(error instanceof Error ? error.message : "KBS team recommendations unavailable");
      })
      .finally(() => setTeamsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

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
          project.status === "open" && (
            <Button
              leftSection={<XCircle size={16} />}
              variant="light"
              color="red"
              onClick={() => setShowCloseModal(true)}
            >
              Close Project
            </Button>
          )
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

      {/* Recommended Freelancers */}
      <Card withBorder radius="md" bg="var(--app-surface)" mb="xl">
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
            <SimpleGrid cols={{ base: 1, lg: 2 }}>
              {freelancerRecommendations.map((item) => (
                <Card key={item.freelancer.id} withBorder radius="md">
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start">
                      <Group gap="sm">
                        <Avatar size={42} radius="xl" color="violet">
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
                      <Badge color="violet" variant="light">
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
                      experienceDetails={item.experienceDetails}
                      relevantExperienceDetails={item.relevantExperienceDetails}
                      projectEvidenceDetails={item.projectEvidenceDetails}
                      graphPath="Project - REQUIRES_SKILL -> Skill <- HAS_SKILL - Freelancer"
                    />
                    <Group gap="xs" wrap="wrap">
                      {item.freelancer.skills.slice(0, 5).map((skill) => (
                        <Badge key={skill} size="sm" color="cyan" variant="light">
                          {skill}
                        </Badge>
                      ))}
                    </Group>
                    <Group gap="xs">
                      {item.freelancer.experienceLevel && (
                        <Badge size="sm" color="gray" variant="light">
                          {item.freelancer.experienceLevel}
                        </Badge>
                      )}
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
          )}
        </Stack>
      </Card>

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
              No synced freelancer team can cover this project yet.
            </Text>
          ) : (
            <Stack gap="md">
              {teamRecommendations.map((team, index) => (
                <Card key={`${team.score}-${index}`} withBorder radius="md">
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
                      score={team.coverageScore}
                      reason={team.reason}
                      matchedSkills={team.coveredSkills}
                      missingSkills={team.missingSkills}
                      graphPath="Project skills are covered by multiple Freelancer - HAS_SKILL relationships"
                      color="teal"
                    />
                    <Group gap="xs">
                      <Badge size="sm" color="blue" variant="light">
                        Tech score: {team.technicalScore}
                      </Badge>
                      <Badge size="sm" color="grape" variant="light">
                        Synergy: {team.synergyScore}
                      </Badge>
                    </Group>
                    {team.sharedEntities.length > 0 && (
                      <Text fz="xs" c="dimmed">
                        Shared graph entities: {team.sharedEntities.slice(0, 6).join(", ")}
                        {team.sharedEntities.length > 6 ? "..." : ""}
                      </Text>
                    )}
                    <Group gap="xs" wrap="wrap">
                      {team.coveredSkills.map((skill) => (
                        <Badge key={skill} size="sm" color="teal" variant="light">
                          {skill}
                        </Badge>
                      ))}
                      {team.missingSkills.map((skill) => (
                        <Badge key={skill} size="sm" color="orange" variant="light">
                          Missing: {skill}
                        </Badge>
                      ))}
                    </Group>
                    <SimpleGrid cols={{ base: 1, md: 2 }}>
                      {team.members.map((member) => (
                        <Card key={member.userId} withBorder radius="sm" p="sm">
                          <Stack gap={6}>
                            <Group justify="space-between" align="flex-start">
                              <Stack gap={1}>
                                <Text fw={600} fz="sm" c="var(--app-text)">
                                  {member.name}
                                </Text>
                                <Text fz="xs" c="dimmed" lineClamp={1}>
                                  {member.headline || member.bestRole || "Freelancer"}
                                </Text>
                              </Stack>
                              {member.hourlyRate && (
                                <Badge size="xs" color="green" variant="light">
                                  ${member.hourlyRate}/hr
                                </Badge>
                              )}
                            </Group>
                            <Text fz="xs" c="dimmed">
                              Covers: {member.coveredSkills.join(", ")}
                            </Text>
                          </Stack>
                        </Card>
                      ))}
                    </SimpleGrid>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

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
