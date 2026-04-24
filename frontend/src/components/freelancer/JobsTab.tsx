"use client";

import {
  Card,
  Text,
  Badge,
  Button,
  Group,
  Stack,
  TextInput,
  Select,
  SimpleGrid,
  Divider,
  Center,
  Avatar,
} from "@mantine/core";
import {
  Search,
  Filter,
  DollarSign,
  User,
  Send,
  CheckCircle2,
  Briefcase,
} from "lucide-react";

interface JobsTabProps {
  projects: any[];
  proposals: any[];
  search: string;
  skillFilter: string | null;
  jobsLoading: boolean;
  allJobSkills: string[];
  onSearchChange: (value: string) => void;
  onSkillFilterChange: (value: string | null) => void;
  onSearchJobs: () => void;
  onApply: (project: any) => void;
}

export function JobsTab({
  projects,
  proposals,
  search,
  skillFilter,
  jobsLoading,
  allJobSkills,
  onSearchChange,
  onSkillFilterChange,
  onSearchJobs,
  onApply,
}: JobsTabProps) {
  return (
    <Stack gap="xl">
      {/* Filter Bar */}
      <Card withBorder radius="md" shadow="sm">
        <Group gap="md" wrap="wrap">
          <TextInput
            placeholder="Search jobs by title or keyword..."
            leftSection={<Search size={16} />}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearchJobs()}
            style={{ flex: 1, minWidth: 250 }}
          />
          <Select
            placeholder="Filter by skill"
            data={allJobSkills}
            value={skillFilter}
            onChange={onSkillFilterChange}
            clearable
            leftSection={<Filter size={16} />}
            style={{ minWidth: 180 }}
          />
          <Button color="cyan" onClick={onSearchJobs} loading={jobsLoading}>
            Search
          </Button>
        </Group>
      </Card>

      {/* Jobs Count */}
      <Group justify="space-between">
        <Text fw={600} c="dark.9">
          {projects.length} job{projects.length !== 1 ? "s" : ""} available
        </Text>
        <Button
          variant="subtle"
          size="sm"
          color="gray"
          onClick={() => {
            onSearchChange("");
            onSkillFilterChange(null);
            onSearchJobs();
          }}
        >
          Clear filters
        </Button>
      </Group>

      {/* Jobs Grid */}
      {projects.length === 0 ? (
        <Card withBorder radius="md" p="xl">
          <Center>
            <Stack align="center" gap="sm">
              <Briefcase size={48} color="#94a3b8" />
              <Text fw={600} c="dimmed">
                No jobs found
              </Text>
              <Text fz="sm" c="dimmed" ta="center">
                Try adjusting your search or check back later for new opportunities.
              </Text>
            </Stack>
          </Center>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {projects.map((project: any) => {
            const hasProposed = proposals.some(
              (p) => p.projectId === project.id
            );
            const skills = project.skills
              ?.split(",")
              .filter(Boolean)
              .map((s: string) => s.trim()) || [];

            return (
              <Card
                key={project.id}
                withBorder
                radius="md"
                shadow="sm"
                style={{
                  transition: "transform 0.15s, box-shadow 0.15s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 25px rgba(0,0,0,0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Badge color="green" variant="light" size="sm">
                      {project.status}
                    </Badge>
                    {project.budget && (
                      <Group gap={4}>
                        <DollarSign size={14} color="var(--mantine-color-cyan-6)" />
                        <Text fw={700} fz="sm" c="dark.9">
                          {project.budgetType === "hourly"
                            ? `$${project.budget}/hr`
                            : `$${project.budget} fixed`}
                        </Text>
                      </Group>
                    )}
                  </Group>

                  <Text fw={700} c="dark.9" lineClamp={2}>
                    {project.title}
                  </Text>
                  <Text fz="sm" c="dimmed" lineClamp={3}>
                    {project.description}
                  </Text>

                  <Group gap="xs" wrap="wrap">
                    {skills.slice(0, 4).map((s: string) => (
                      <Badge key={s} size="sm" variant="light" color="cyan">
                        {s}
                      </Badge>
                    ))}
                    {skills.length > 4 && (
                      <Badge size="sm" variant="light" color="gray">
                        +{skills.length - 4}
                      </Badge>
                    )}
                  </Group>

                  <Divider />

                  <Group justify="space-between">
                    <Group gap="xs">
                      <Avatar size={24} radius="xl" color="indigo">
                        <User size={12} />
                      </Avatar>
                      <Text fz="sm" c="dimmed">
                        {project.client?.name || "Client"}
                      </Text>
                    </Group>
                    <Text fz="xs" c="dimmed">
                      {project._count?.proposals || 0} proposals
                    </Text>
                  </Group>

                  <Button
                    fullWidth
                    color={hasProposed ? "gray" : "cyan"}
                    variant={hasProposed ? "light" : "filled"}
                    disabled={hasProposed}
                    onClick={() => onApply(project)}
                  >
                    {hasProposed ? (
                      <Group gap={6}>
                        <CheckCircle2 size={16} />
                        Applied
                      </Group>
                    ) : (
                      <Group gap={6}>
                        <Send size={16} />
                        Apply Now
                      </Group>
                    )}
                  </Button>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      )}
    </Stack>
  );
}
