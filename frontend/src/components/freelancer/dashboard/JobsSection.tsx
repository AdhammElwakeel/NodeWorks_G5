"use client";

import { useState } from "react";
import {
  Box,
  Card,
  Text,
  Badge,
  Button,
  Group,
  Stack,
  SimpleGrid,
  TextInput,
  Select,
  ActionIcon,
  Avatar,
  Divider,
  Center,
  useMantineColorScheme,
} from "@mantine/core";
import { Search, Filter, Send, Bookmark, Briefcase, DollarSign } from "lucide-react";
import type { Job } from "./types";

interface JobsSectionProps {
  jobs: Job[];
  onApply: (job: Job) => void;
}

export function JobsSection({ jobs, onApply }: JobsSectionProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const textPrimary = isDark ? "gray.0" : "black";

  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState<string | null>(null);
  const [savedJobs, setSavedJobs] = useState<Set<string>>(
    new Set(jobs.filter((j) => j.saved).map((j) => j.id))
  );

  const allJobSkills = Array.from(new Set(jobs.flatMap((j) => j.skills)));

  const filteredJobs = jobs.filter((job) => {
    const matchSearch =
      !search ||
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.description.toLowerCase().includes(search.toLowerCase());
    const matchSkill = !skillFilter || job.skills.includes(skillFilter);
    return matchSearch && matchSkill;
  });

  function toggleSave(jobId: string) {
    setSavedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  return (
    <Stack gap="xl">
      {/* Search & Filter */}
      <Card withBorder radius="md" shadow={isDark ? undefined : "sm"}>
        <Group gap="md" wrap="wrap">
          <TextInput
            placeholder="Search jobs by title or keyword..."
            leftSection={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 250 }}
            radius="md"
            size="md"
          />
          <Select
            placeholder="Filter by skill"
            data={allJobSkills}
            value={skillFilter}
            onChange={setSkillFilter}
            clearable
            leftSection={<Filter size={16} />}
            style={{ minWidth: 180 }}
            radius="md"
            size="md"
          />
          <Button color="cyan" radius="md" size="md" onClick={() => {}}>
            Search
          </Button>
        </Group>
      </Card>

      <Group justify="space-between">
        <Text fw={600} c={textPrimary}>
          {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""} found
        </Text>
        <Button
          variant="subtle"
          size="sm"
          color="gray"
          onClick={() => {
            setSearch("");
            setSkillFilter(null);
          }}
        >
          Clear filters
        </Button>
      </Group>

      {/* Job Cards */}
      {filteredJobs.length === 0 ? (
        <Card withBorder radius="md" p="xl">
          <Center>
            <Stack align="center" gap="sm">
              <Briefcase size={48} color="#94a3b8" />
              <Text fw={600} c={textPrimary}>
                No jobs found
              </Text>
              <Text fz="sm" c={textPrimary} ta="center">
                Try adjusting your search or check back later for new
                opportunities.
              </Text>
            </Stack>
          </Center>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {filteredJobs.map((job) => {
            const isSaved = savedJobs.has(job.id);
            return (
              <Card
                key={job.id}
                withBorder
                radius="md"
                shadow={isDark ? undefined : "sm"}
                style={{
                  transition: "all 0.2s ease",
                  position: "relative",
                  overflow: "visible",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(-4px)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 12px 40px rgba(0,0,0,0.1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                <ActionIcon
                  variant="subtle"
                  color={isSaved ? "pink" : "gray"}
                  style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSave(job.id);
                  }}
                >
                  <Bookmark
                    size={18}
                    fill={isSaved ? "currentColor" : "none"}
                  />
                </ActionIcon>

                <Stack gap="sm">
                  <Group justify="space-between" pr={30}>
                    <Badge
                      color="green"
                      variant="light"
                      size="sm"
                      radius="sm"
                    >
                      Open
                    </Badge>
                    {job.budget && (
                      <Group gap={4}>
                        <DollarSign
                          size={14}
                          color="var(--mantine-color-cyan-6)"
                        />
                        <Text fw={700} fz="sm" c={textPrimary}>
                          {job.budgetType === "hourly"
                            ? `$${job.budget}/hr`
                            : `$${job.budget.toLocaleString()}`}
                        </Text>
                      </Group>
                    )}
                  </Group>

                  <Text fw={700} c={textPrimary} lineClamp={2} fz="lg">
                    {job.title}
                  </Text>
                  <Text fz="sm" c={textPrimary} lineClamp={3}>
                    {job.description}
                  </Text>

                  <Group gap="xs" wrap="wrap">
                    {job.skills.slice(0, 4).map((s: string) => (
                      <Badge
                        key={s}
                        size="sm"
                        variant="light"
                        color="cyan"
                        radius="sm"
                        style={{
                          background: "rgba(6,182,212,0.06)",
                          border: "1px solid rgba(6,182,212,0.15)",
                        }}
                      >
                        {s}
                      </Badge>
                    ))}
                    {job.skills.length > 4 && (
                      <Badge
                        size="sm"
                        variant="light"
                        color="gray"
                        radius="sm"
                      >
                        +{job.skills.length - 4}
                      </Badge>
                    )}
                  </Group>

                  <Divider />

                  <Group justify="space-between">
                    <Group gap="xs">
                      <Avatar
                        size={28}
                        radius="xl"
                        color="indigo"
                        fz="xs"
                      >
                        {job.clientAvatar}
                      </Avatar>
                      <Stack gap={0}>
                        <Text fz="sm" fw={500} c={textPrimary}>
                          {job.clientName}
                        </Text>
                        <Text fz="xs" c={textPrimary}>
                          {job.postedAt} · {job.proposals} proposals
                        </Text>
                      </Stack>
                    </Group>
                  </Group>

                  <Button
                    fullWidth
                    color="cyan"
                    radius="md"
                    leftSection={<Send size={16} />}
                    onClick={() => onApply(job)}
                  >
                    Apply Now
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
