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
  Avatar,
  Badge,
  Loader,
  Divider,
  Rating,
  SimpleGrid,
} from "@mantine/core";
import {
  ArrowLeft,
  Check,
  X,
  User,
  DollarSign,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/client/PageHeader";
import { StatusBadge } from "@/components/client/StatusBadge";
import { SkillsTags } from "@/components/client/SkillsTags";
import { ConfirmModal } from "@/components/client/ConfirmModal";
import {
  clientApi,
  type ClientProject,
  type Proposal,
} from "@/lib/mock/clientApi";

export default function ProjectProposalsPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ClientProject | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionTarget, setActionTarget] = useState<{
    proposalId: string;
    action: "accept" | "reject";
  } | null>(null);
  const [acting, setActing] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    const [p, pr] = await Promise.all([
      clientApi.getProject(id),
      clientApi.listProjectProposals(id),
    ]);
    setProject(p);
    setProposals(pr);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAction = async () => {
    if (!actionTarget) return;
    setActing(true);
    await clientApi.updateProposalStatus(
      actionTarget.proposalId,
      actionTarget.action === "accept" ? "accepted" : "rejected"
    );
    setActionTarget(null);
    setActing(false);
    fetchData();
  };

  const pendingProposals = proposals.filter((p) => p.status === "pending");
  const acceptedProposals = proposals.filter((p) => p.status === "accepted");
  const rejectedProposals = proposals.filter((p) => p.status === "rejected");

  if (loading) {
    return (
      <Box ta="center" py="xl">
        <Loader size="md" />
      </Box>
    );
  }

  return (
    <Box>
      <Group mb="lg">
        <Button
          component={Link}
          href={`/client/projects/${id}`}
          variant="subtle"
          leftSection={<ArrowLeft size={16} />}
          size="sm"
        >
          Back to project
        </Button>
      </Group>

      <PageHeader
        title={project?.title ?? "Project Proposals"}
        subtitle={`${proposals.length} total proposals · ${pendingProposals.length} pending`}
      />

      {proposals.length === 0 ? (
        <Card withBorder radius="md" bg="white" py="xl">
          <Text ta="center" c="dimmed">
            No proposals yet for this project.
          </Text>
        </Card>
      ) : (
        <Stack gap="xl">
          {/* Pending */}
          {pendingProposals.length > 0 && (
            <Box>
              <Text fw={600} c="dark.9" mb="md">
                Pending Proposals ({pendingProposals.length})
              </Text>
              <SimpleGrid cols={{ base: 1, lg: 2 }}>
                {pendingProposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    onAccept={() =>
                      setActionTarget({
                        proposalId: proposal.id,
                        action: "accept",
                      })
                    }
                    onReject={() =>
                      setActionTarget({
                        proposalId: proposal.id,
                        action: "reject",
                      })
                    }
                  />
                ))}
              </SimpleGrid>
            </Box>
          )}

          {/* Accepted */}
          {acceptedProposals.length > 0 && (
            <Box>
              <Divider mb="md" />
              <Text fw={600} c="dark.9" mb="md">
                Accepted ({acceptedProposals.length})
              </Text>
              <SimpleGrid cols={{ base: 1, lg: 2 }}>
                {acceptedProposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    readonly
                  />
                ))}
              </SimpleGrid>
            </Box>
          )}

          {/* Rejected */}
          {rejectedProposals.length > 0 && (
            <Box>
              <Divider mb="md" />
              <Text fw={600} c="dark.9" mb="md">
                Rejected ({rejectedProposals.length})
              </Text>
              <SimpleGrid cols={{ base: 1, lg: 2 }}>
                {rejectedProposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    readonly
                  />
                ))}
              </SimpleGrid>
            </Box>
          )}
        </Stack>
      )}

      <ConfirmModal
        opened={!!actionTarget}
        onClose={() => setActionTarget(null)}
        onConfirm={handleAction}
        title={
          actionTarget?.action === "accept"
            ? "Accept Proposal"
            : "Reject Proposal"
        }
        description={
          actionTarget?.action === "accept"
            ? "Are you sure you want to accept this proposal? The freelancer will be notified."
            : "Are you sure you want to reject this proposal? This cannot be undone."
        }
        confirmLabel={
          actionTarget?.action === "accept" ? "Accept" : "Reject"
        }
        confirmColor={actionTarget?.action === "accept" ? "green" : "red"}
        loading={acting}
      />
    </Box>
  );
}

// ─── Proposal Card ───────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  onAccept,
  onReject,
  readonly,
}: {
  proposal: Proposal;
  onAccept?: () => void;
  onReject?: () => void;
  readonly?: boolean;
}) {
  return (
    <Card withBorder radius="md" bg="white">
      <Stack gap="md">
        {/* Freelancer Header */}
        <Group align="flex-start">
          <Avatar size={48} radius="xl" color="cyan">
            <User size={24} />
          </Avatar>
          <Stack gap={2} style={{ flex: 1 }}>
            <Group gap="xs">
              <Text fw={600} c="dark.9">
                {proposal.freelancerName}
              </Text>
              {proposal.status !== "pending" && (
                <StatusBadge
                  status={
                    proposal.status === "accepted" ? "open" : "closed"
                  }
                />
              )}
            </Group>
            <Group gap={4}>
              <Rating
                value={proposal.freelancerRating}
                fractions={2}
                readOnly
                size="xs"
              />
              <Text fz="xs" c="dimmed">
                {proposal.freelancerRating}
              </Text>
            </Group>
          </Stack>
        </Group>

        {/* Skills */}
        <SkillsTags skills={proposal.freelancerSkills} />

        {/* Cover Letter */}
        <Text c="dark.9" fz="sm" style={{ lineHeight: 1.6 }}>
          {proposal.coverLetter}
        </Text>

        {/* Rate & Date */}
        <Group gap="xs">
          <Badge variant="light" color="cyan" size="sm">
            <Group gap={4}>
              <DollarSign size={12} />
              ${proposal.proposedRate.toLocaleString()}
            </Group>
          </Badge>
          <Badge variant="light" color="gray" size="sm">
            <Group gap={4}>
              <Calendar size={12} />
              {new Date(proposal.submittedAt).toLocaleDateString()}
            </Group>
          </Badge>
        </Group>

        {/* Actions */}
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
