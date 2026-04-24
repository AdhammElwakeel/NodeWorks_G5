"use client";

import {
  Grid,
  Card,
  Text,
  Group,
  Stack,
  Badge,
  ActionIcon,
  Divider,
  ThemeIcon,
  Progress,
} from "@mantine/core";
import {
  User,
  FileText,
  Award,
  Globe,
  DollarSign,
  Clock,
  Edit3,
  Link as LinkIcon,
} from "lucide-react";

interface ProfileTabProps {
  profile: any;
  onEditClick: () => void;
}

export function ProfileTab({ profile, onEditClick }: ProfileTabProps) {
  const fp = profile?.freelancerProfile;

  const hasProfile = !!fp?.headline && !!fp?.skills?.length;
  const profileCompletion = hasProfile
    ? Math.min(
        100,
        20 +
          (fp?.about ? 20 : 0) +
          (fp?.skills?.length ? 20 : 0) +
          (fp?.hourlyRate ? 15 : 0) +
          (fp?.country ? 10 : 0) +
          (fp?.experienceLevel ? 15 : 0)
      )
    : 25;

  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 4 }}>
        <Stack gap="md">
          <Card withBorder radius="md" shadow="sm">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={600} c="dark.9">Profile Completion</Text>
                <Text fw={700} c="cyan.8">{profileCompletion}%</Text>
              </Group>
              <Progress
                value={profileCompletion}
                color={profileCompletion > 80 ? "green" : "cyan"}
                radius="xl"
                size="md"
              />
              {profileCompletion < 80 && (
                <Text fz="xs" c="dimmed">
                  Complete your profile to get more job matches
                </Text>
              )}
            </Stack>
          </Card>

          <Card withBorder radius="md" shadow="sm">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={600} c="dark.9">Skills</Text>
                <ActionIcon variant="subtle" color="cyan" onClick={onEditClick}>
                  <Edit3 size={16} />
                </ActionIcon>
              </Group>
              <Group gap="xs" wrap="wrap">
                {fp?.skills?.length ? (
                  fp.skills.map((skill: string) => (
                    <Badge key={skill} color="cyan" variant="light" size="md" radius="sm">
                      {skill}
                    </Badge>
                  ))
                ) : (
                  <Text fz="sm" c="dimmed">No skills added yet</Text>
                )}
              </Group>
            </Stack>
          </Card>

          <Card withBorder radius="md" shadow="sm">
            <Stack gap="xs">
              <Text fw={600} c="dark.9">Hourly Rate</Text>
              <Group gap="xs">
                <DollarSign size={18} color="var(--mantine-color-cyan-6)" />
                <Text fw={700} fz="xl" c="dark.9">
                  {fp?.hourlyRate ? `$${fp.hourlyRate}/hr` : "Not set"}
                </Text>
              </Group>
            </Stack>
          </Card>

          <Card withBorder radius="md" shadow="sm">
            <Stack gap="xs">
              <Text fw={600} c="dark.9">Availability</Text>
              <Group gap="xs">
                <Clock size={18} color="var(--mantine-color-green-6)" />
                <Text c="dark.9">{fp?.availability || "Not specified"}</Text>
              </Group>
            </Stack>
          </Card>
        </Stack>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 8 }}>
        <Stack gap="md">
          <Card withBorder radius="md" shadow="sm">
            <Stack gap="sm">
              <Group justify="space-between">
                <Group gap="sm">
                  <ThemeIcon color="blue" variant="light" radius="md">
                    <FileText size={16} />
                  </ThemeIcon>
                  <Text fw={700} c="dark.9" fz="lg">About</Text>
                </Group>
                <ActionIcon variant="subtle" color="cyan" onClick={onEditClick}>
                  <Edit3 size={16} />
                </ActionIcon>
              </Group>
              <Text c="dark.9" style={{ whiteSpace: "pre-line" }}>
                {fp?.about || (
                  <Text span c="dimmed" fz="sm">
                    Tell clients about your expertise, experience, and what makes you unique. Click Edit Profile to add your bio.
                  </Text>
                )}
              </Text>
            </Stack>
          </Card>

          <Card withBorder radius="md" shadow="sm">
            <Stack gap="sm">
              <Group justify="space-between">
                <Group gap="sm">
                  <ThemeIcon color="indigo" variant="light" radius="md">
                    <Award size={16} />
                  </ThemeIcon>
                  <Text fw={700} c="dark.9" fz="lg">Experience</Text>
                </Group>
                <ActionIcon variant="subtle" color="cyan" onClick={onEditClick}>
                  <Edit3 size={16} />
                </ActionIcon>
              </Group>
              <Group gap="sm">
                <Badge size="lg" variant="light" color="indigo">
                  {fp?.experienceLevel || "Not set"}
                </Badge>
              </Group>
            </Stack>
          </Card>

          <Card withBorder radius="md" shadow="sm">
            <Stack gap="sm">
              <Group justify="space-between">
                <Group gap="sm">
                  <ThemeIcon color="green" variant="light" radius="md">
                    <Globe size={16} />
                  </ThemeIcon>
                  <Text fw={700} c="dark.9" fz="lg">Portfolio Links</Text>
                </Group>
                <ActionIcon variant="subtle" color="cyan" onClick={onEditClick}>
                  <Edit3 size={16} />
                </ActionIcon>
              </Group>
              {fp?.portfolioLinks?.length ? (
                <Stack gap="xs">
                  {fp.portfolioLinks.map((link: string, i: number) => (
                    <Group key={i} gap="xs">
                      <LinkIcon size={14} color="var(--mantine-color-cyan-6)" />
                      <Text
                        component="a"
                        href={link}
                        target="_blank"
                        c="cyan.7"
                        fz="sm"
                        style={{ textDecoration: "none" }}
                      >
                        {link}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              ) : (
                <Text fz="sm" c="dimmed">
                  Add your GitHub, LinkedIn, portfolio website, or other relevant links.
                </Text>
              )}
            </Stack>
          </Card>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
