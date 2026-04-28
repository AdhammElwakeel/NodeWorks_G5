"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Table,
  Badge,
  Loader,
  Stack,
  Text,
  Card,
  Group,
} from "@mantine/core";
import { Plus, Eye, XCircle } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/client/PageHeader";
import { StatusBadge } from "@/components/client/StatusBadge";
import { ConfirmModal } from "@/components/client/ConfirmModal";
import { projectApi, type ProjectData } from "@/lib/api";
import { notifications } from "@mantine/notifications";

export default function ClientProjectsPage() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [closeTarget, setCloseTarget] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const fetchProjects = () => {
    setLoading(true);
    projectApi
      .list({ mine: true })
      .then((data) => setProjects(data.projects))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleClose = async () => {
    if (!closeTarget) return;
    setClosing(true);
    try {
      await projectApi.update(closeTarget, { status: "closed" });
      notifications.show({
        title: "Project closed",
        message: "No new proposals will be accepted.",
        color: "green",
      });
      fetchProjects();
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to close project.",
        color: "red",
      });
    } finally {
      setCloseTarget(null);
      setClosing(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="My Projects"
        subtitle="Manage all your posted projects"
        actions={
          <Button
            component={Link}
            href="/client/projects/new"
            leftSection={<Plus size={18} />}
            variant="gradient"
            gradient={{ from: "indigo", to: "cyan", deg: 135 }}
          >
            New Project
          </Button>
        }
      />

      {loading ? (
        <Box ta="center" py="xl">
          <Loader size="md" />
        </Box>
      ) : projects.length === 0 ? (
        <Card withBorder radius="md" bg="white" py="xl">
          <Text ta="center" c="dimmed">
            No projects yet.{" "}
            <Button
              component={Link}
              href="/client/projects/new"
              variant="subtle"
              size="sm"
              px={0}
            >
              Create your first project
            </Button>
          </Text>
        </Card>
      ) : (
        <Card withBorder radius="md" bg="white" p={0}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Title</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Budget</Table.Th>
                <Table.Th>Proposals</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {projects.map((project) => (
                <Table.Tr key={project.id}>
                  <Table.Td>
                    <Text fw={500} c="dark.9" fz="sm">
                      {project.title}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={project.status} />
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="cyan" size="sm">
                      ${project.budget.toLocaleString()}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{project.proposalsCount}</Table.Td>
                  <Table.Td>
                    <Text fz="sm" c="dimmed">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }}>
                    <Group gap="xs" justify="flex-end">
                      <Button
                        component={Link}
                        href={`/client/projects/${project.id}`}
                        size="xs"
                        variant="light"
                        leftSection={<Eye size={14} />}
                      >
                        View
                      </Button>
                      {project.status === "open" && (
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          leftSection={<XCircle size={14} />}
                          onClick={() => setCloseTarget(project.id)}
                        >
                          Close
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      <ConfirmModal
        opened={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        onConfirm={handleClose}
        title="Close Project"
        description="Are you sure you want to close this project? No new proposals will be accepted."
        confirmLabel="Close Project"
        confirmColor="red"
        loading={closing}
      />
    </Box>
  );
}