"use client";

import {
  Card,
  Text,
  Badge,
  Group,
  Stack,
  Center,
  Button,
  ThemeIcon,
} from "@mantine/core";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock4,
  Briefcase,
} from "lucide-react";

interface ProposalsTabProps {
  proposals: any[];
  onBrowseJobs: () => void;
}

export function ProposalsTab({ proposals, onBrowseJobs }: ProposalsTabProps) {
  if (proposals.length === 0) {
    return (
      <Card withBorder radius="md" p="xl">
        <Center>
          <Stack align="center" gap="sm">
            <FileText size={48} color="#94a3b8" />
            <Text fw={600} c="dimmed">
              No proposals yet
            </Text>
            <Text fz="sm" c="dimmed" ta="center">
              Browse the Jobs tab and start applying to projects that match your
              skills.
            </Text>
            <Button color="black" mt="sm" onClick={onBrowseJobs}>
              Browse Jobs
            </Button>
          </Stack>
        </Center>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      {proposals.map((proposal: any) => (
        <Card key={proposal.id} withBorder radius="md" shadow="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={6} style={{ flex: 1 }}>
              <Group gap="sm">
                <Text fw={700} c="dark.9" fz="lg">
                  {proposal.project?.title}
                </Text>
                <Badge
                  color={
                    proposal.status === "accepted"
                      ? "green"
                      : proposal.status === "rejected"
                        ? "red"
                        : "orange"
                  }
                  variant="light"
                >
                  {proposal.status}
                </Badge>
              </Group>
              <Text fz="sm" c="dimmed" lineClamp={2}>
                {proposal.coverLetter}
              </Text>
              {proposal.proposedRate && (
                <Text fz="sm" fw={500} c="cyan.7">
                  Proposed rate: ${proposal.proposedRate}
                </Text>
              )}
              <Text fz="xs" c="gray.5">
                Submitted {new Date(proposal.createdAt).toLocaleDateString()}
              </Text>
            </Stack>

            <ThemeIcon
              color={
                proposal.status === "accepted"
                  ? "green"
                  : proposal.status === "rejected"
                    ? "red"
                    : "orange"
              }
              variant="light"
              size={40}
              radius="xl"
            >
              {proposal.status === "accepted" ? (
                <CheckCircle2 size={20} />
              ) : proposal.status === "rejected" ? (
                <XCircle size={20} />
              ) : (
                <Clock4 size={20} />
              )}
            </ThemeIcon>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
