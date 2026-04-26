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
} from "@mantine/core";
import { Plus, FolderOpen, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/client/PageHeader";
import { StatusBadge } from "@/components/client/StatusBadge";
import { SkillsTags } from "@/components/client/SkillsTags";
import { clientApi, type ClientProject } from "@/lib/mock/clientApi";

export default function ClientDashboardPage() {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientApi
      .listMyProjects()
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

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
            variant="gradient"
            gradient={{ from: "indigo", to: "cyan", deg: 135 }}
          >
            Create new project
          </Button>
        }
      />

      {/* Stats Cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
        <Card withBorder radius="md" bg="white">
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
              <Text fw={700} fz="xl" c="dark.9">
                {openCount}
              </Text>
            </Stack>
          </Group>
        </Card>
        <Card withBorder radius="md" bg="white">
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
              <Text fw={700} fz="xl" c="dark.9">
                {closedCount}
              </Text>
            </Stack>
          </Group>
        </Card>
        <Card withBorder radius="md" bg="white">
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
              <Text fw={700} fz="xl" c="dark.9">
                {totalProposals}
              </Text>
            </Stack>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Recent Projects */}
      <Text fw={600} fz="lg" c="dark.9" mb="md">
        Recent Projects
      </Text>

      {loading ? (
        <Box ta="center" py="xl">
          <Loader size="md" />
        </Box>
      ) : recentProjects.length === 0 ? (
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
        <Stack gap="md">
          {recentProjects.map((project) => (
            <Card
              key={project.id}
              withBorder
              radius="md"
              bg="white"
              component={Link}
              href={`/client/projects/${project.id}`}
              style={{ textDecoration: "none" }}
            >
              <Group justify="space-between" align="flex-start" mb="xs">
                <Box>
                  <Text fw={600} c="dark.9" fz="md">
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
