"use client";

import { Box, Card, Text, Badge, Button, Group, Stack, Grid, ThemeIcon, ActionIcon, Progress, useMantineColorScheme } from "@mantine/core";
import { DollarSign, FileText, Award, Globe, Link as LinkIcon, ChevronRight, Edit3 } from "lucide-react";
import type { Profile, Proposal } from "./types";

interface HomeSectionProps {
  profile: Profile;
  proposals: Proposal[];
  profileCompletion: number;
  onEditClick: () => void;
}

export function HomeSection({ profile, proposals, profileCompletion, onEditClick }: HomeSectionProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const textPrimary = isDark ? "gray.0" : "black";

  return (
    <Stack gap="xl">
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            {/* Profile Completion */}
            <Card withBorder radius="md" shadow={isDark ? undefined : "sm"}>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={600} c={textPrimary}>Profile Completion</Text>
                  <Text fw={700} c="cyan.8">{profileCompletion}%</Text>
                </Group>
                <Progress
                  value={profileCompletion}
                  color={profileCompletion > 80 ? "green" : "cyan"}
                  radius="xl"
                  size="md"
                />
              </Stack>
            </Card>

            {/* Skills */}
            <Card withBorder radius="md" shadow={isDark ? undefined : "sm"}>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={600} c={textPrimary}>Skills</Text>
                  <ActionIcon variant="subtle" color="cyan" onClick={onEditClick}>
                    <Edit3 size={16} />
                  </ActionIcon>
                </Group>
                <Group gap="xs" wrap="wrap">
                  {profile.skills.map((skill) => (
                    <Badge
                      key={skill}
                      color="cyan"
                      variant="light"
                      size="md"
                      radius="sm"
                      style={{
                        background: "rgba(6,182,212,0.08)",
                        border: "1px solid rgba(6,182,212,0.2)",
                      }}
                    >
                      {skill}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </Card>

            {/* Hourly Rate */}
            <Card withBorder radius="md" shadow={isDark ? undefined : "sm"}>
              <Stack gap="xs">
                <Text fw={600} c={textPrimary}>Hourly Rate</Text>
                <Group gap="xs">
                  <DollarSign size={18} color="var(--mantine-color-cyan-6)" />
                  <Text fw={700} fz="xl" c={textPrimary}>
                    ${profile.hourlyRate}/hr
                  </Text>
                </Group>
              </Stack>
            </Card>

            {/* Availability */}
            <Card withBorder radius="md" shadow={isDark ? undefined : "sm"}>
              <Stack gap="xs">
                <Text fw={600} c={textPrimary}>Availability</Text>
                <Group gap="xs">
                  <Box
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#22c55e",
                    }}
                  />
                  <Text c={textPrimary}>{profile.availability}</Text>
                </Group>
              </Stack>
            </Card>

            {/* Member Since */}
            <Card withBorder radius="md" shadow={isDark ? undefined : "sm"}>
              <Stack gap="xs">
                <Text fw={600} c={textPrimary}>Member Since</Text>
                <Text c={textPrimary}>{profile.memberSince}</Text>
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            {/* About */}
            <Card withBorder radius="md" shadow={isDark ? undefined : "sm"}>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon color="blue" variant="light" radius="md">
                      <FileText size={16} />
                    </ThemeIcon>
                    <Text fw={700} c={textPrimary} fz="lg">
                      About
                    </Text>
                  </Group>
                  <ActionIcon variant="subtle" color="cyan" onClick={onEditClick}>
                    <Edit3 size={16} />
                  </ActionIcon>
                </Group>
                <Text c={textPrimary} style={{ whiteSpace: "pre-line", lineHeight: 1.7 }}>
                  {profile.about}
                </Text>
              </Stack>
            </Card>

            {/* Experience */}
            <Card withBorder radius="md" shadow={isDark ? undefined : "sm"}>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon color="indigo" variant="light" radius="md">
                      <Award size={16} />
                    </ThemeIcon>
                    <Text fw={700} c={textPrimary} fz="lg">
                      Experience
                    </Text>
                  </Group>
                  <ActionIcon variant="subtle" color="cyan" onClick={onEditClick}>
                    <Edit3 size={16} />
                  </ActionIcon>
                </Group>
                <Badge size="lg" variant="light" color="indigo">
                  {profile.experienceLevel} Level
                </Badge>
                <Text fz="sm" c={textPrimary}>
                  7+ years in full-stack development across multiple industries
                </Text>
              </Stack>
            </Card>

            {/* Portfolio Links */}
            <Card withBorder radius="md" shadow={isDark ? undefined : "sm"}>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon color="green" variant="light" radius="md">
                      <Globe size={16} />
                    </ThemeIcon>
                    <Text fw={700} c={textPrimary} fz="lg">
                      Portfolio Links
                    </Text>
                  </Group>
                  <ActionIcon variant="subtle" color="cyan" onClick={onEditClick}>
                    <Edit3 size={16} />
                  </ActionIcon>
                </Group>
                <Stack gap="xs">
                  {profile.portfolioLinks.map((link, i) => (
                    <Card
                      key={i}
                      withBorder
                      radius="sm"
                      p="xs"
                      style={{ cursor: "pointer" }}
                      onClick={() => window.open(link, "_blank")}
                    >
                      <Group gap="xs">
                        <LinkIcon size={14} color="var(--mantine-color-cyan-6)" />
                        <Text c="cyan.7" fz="sm" fw={500}>
                          {link.replace(/^https?:\/\//, "")}
                        </Text>
                        <ChevronRight
                          size={14}
                          color="var(--mantine-color-gray-5)"
                          style={{ marginLeft: "auto" }}
                        />
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Stack>
            </Card>

            {/* Recent Proposals */}
            <Card withBorder radius="md" shadow={isDark ? undefined : "sm"}>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon color="orange" variant="light" radius="md">
                      <FileText size={16} />
                    </ThemeIcon>
                    <Text fw={700} c={textPrimary} fz="lg">
                      Recent Proposals
                    </Text>
                  </Group>
                  <Button variant="subtle" size="xs" onClick={() => {}}>
                    View All
                  </Button>
                </Group>
                <Stack gap="xs">
                  {proposals.map((proposal) => (
                    <Card key={proposal.id} withBorder radius="sm" p="xs">
                      <Group justify="space-between" align="flex-start">
                        <Stack gap={4} style={{ flex: 1 }}>
                          <Group gap="sm">
                            <Text fw={600} c={textPrimary} fz="sm">
                              {proposal.projectTitle}
                            </Text>
                            <Badge
                              size="sm"
                              variant="light"
                              color={
                                proposal.status === "accepted"
                                  ? "green"
                                  : proposal.status === "rejected"
                                  ? "red"
                                  : "orange"
                              }
                            >
                              {proposal.status}
                            </Badge>
                          </Group>
                          <Text fz="xs" c={textPrimary} lineClamp={2}>
                            {proposal.coverLetter}
                          </Text>
                        </Stack>
                        <Text fz="sm" fw={500} c="cyan.7">
                          ${proposal.proposedRate.toLocaleString()}
                        </Text>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
