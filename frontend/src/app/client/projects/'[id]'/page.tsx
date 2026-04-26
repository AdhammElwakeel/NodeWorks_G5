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
  SimpleGrid,
} from "@mantine/core";
import {
  ArrowLeft,
  Users,
  Pencil,
  XCircle,
  DollarSign,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/client/PageHeader";
import { StatusBadge } from "@/components/client/StatusBadge";
import { SkillsTags } from "@/components/client/SkillsTags";
import { ConfirmModal } from "@/components/client/ConfirmModal";
import { clientApi, type ClientProject } from "@/lib/mock/clientApi";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ClientProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    clientApi
      .getProject(id)
      .then((p) => setProject(p))
      .finally(() => setLoading(false));
  }, [id]);

  const handleClose = async () => {
    if (!project) return;
    setClosing(true);
    await clientApi.closeProject(project.id);
    setClosing(false);
    setShowCloseModal(false);
    clientApi.getProject(id).then(setProject);
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
        <Card withBorder radius="md" bg="white" py="xl">
          <Text ta="center" c="dimmed">
            Project not found.
          </Text>
        </Card>
      </Box>
    );
  }

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

      <PageHeader
        title={project.title}
        actions={
          <Group gap="sm">
            {project.status === "open" && (
              <>
                <Button
                  component={Link}
                  href={`/client/projects/${project.id}/proposals`}
                  leftSection={<Users size={16} />}
                  variant="light"
                  color="indigo"
                >
                  View Proposals ({project.proposalsCount})
                </Button>
                <Button leftSection={<Pencil size={16} />} variant="default">
                  Edit
                </Button>
                <Button
                  leftSection={<XCircle size={16} />}
                  variant="light"
                  color="red"
                  onClick={() => setShowCloseModal(true)}
                >
                  Close
                </Button>
              </>
            )}
          </Group>
        }
      />

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
        <Card
          withBorder
          radius="md"
          bg="white"
          style={{ gridColumn: "1 / -1" }}
        >
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Group gap="xs">
                <StatusBadge status={project.status} />
                <Badge variant="light" color="cyan" size="sm">
                  <Group gap={4}>
                    <DollarSign size={12} />
                    {project.budget.toLocaleString()}
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

            <Text c="dark.9" fz="sm" style={{ lineHeight: 1.7 }}>
              {project.description}
            </Text>

            <Box>
              <Text fw={600} fz="sm" c="dark.9" mb="xs">
                Required Skills
              </Text>
              <SkillsTags skills={project.skills} />
            </Box>
          </Stack>
        </Card>
      </SimpleGrid>

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
    </Box>
  );
}
