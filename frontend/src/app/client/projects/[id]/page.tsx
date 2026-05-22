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
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/client/PageHeader";
import { StatusBadge } from "@/components/client/StatusBadge";
import { SkillsTags } from "@/components/client/SkillsTags";
import { ConfirmModal } from "@/components/client/ConfirmModal";
import { projectApi, proposalApi, type ProjectData, type ProposalData } from "@/lib/api";
import { notifications } from "@mantine/notifications";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closing, setClosing] = useState(false);

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
  }, [id]);

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
