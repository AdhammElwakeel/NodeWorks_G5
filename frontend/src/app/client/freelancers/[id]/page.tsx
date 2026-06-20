"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Anchor,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { ArrowLeft, Briefcase, DollarSign, ExternalLink, Mail, MapPin, Sparkles, User } from "lucide-react";
import { freelancerApi, type PublicFreelancerData } from "@/lib/api";
import { PageHeader } from "@/components/client/PageHeader";

export default function ClientFreelancerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [freelancer, setFreelancer] = useState<PublicFreelancerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    queueMicrotask(() => {
      setLoading(true);
      freelancerApi
        .get(id)
        .then((data) => {
          setFreelancer(data.freelancer);
          setError(null);
        })
        .catch((err: unknown) => {
          setFreelancer(null);
          setError(err instanceof Error ? err.message : "Failed to load freelancer profile");
        })
        .finally(() => setLoading(false));
    });
  }, [id]);

  if (loading) {
    return (
      <Center py={80}>
        <Loader color="teal" />
      </Center>
    );
  }

  if (error || !freelancer) {
    return (
      <Stack gap="md">
        <Button component={Link} href="/client/projects" variant="subtle" leftSection={<ArrowLeft size={16} />}>
          Back to projects
        </Button>
        <Card withBorder radius="lg" p="xl" bg="var(--app-surface)">
          <Text c="orange">{error || "Freelancer not found"}</Text>
        </Card>
      </Stack>
    );
  }

  const cvProjects = freelancer.cvAnalysis?.projects || [];
  const experience = freelancer.cvAnalysis?.experience || [];
  const domains = freelancer.cvAnalysis?.domainKnowledge || [];

  return (
    <Stack gap="xl">
      <PageHeader title="Freelancer Profile" subtitle="Review candidate fit before starting a conversation." />

      <Button component={Link} href="/client/projects" variant="subtle" leftSection={<ArrowLeft size={16} />} w="fit-content">
        Back to projects
      </Button>

      <Card
        withBorder
        radius="xl"
        p={{ base: "lg", md: "xl" }}
        style={{
          background:
            "linear-gradient(135deg, rgba(20,184,166,0.12), rgba(99,102,241,0.10) 48%, var(--app-surface) 100%)",
        }}
      >
        <Group justify="space-between" align="flex-start" gap="xl">
          <Group gap="lg" align="flex-start">
            <Avatar size={82} radius="xl" color="teal" src={freelancer.avatar || undefined}>
              <User size={38} />
            </Avatar>
            <Stack gap="xs">
              <Text fz={{ base: 26, md: 34 }} fw={800} c="var(--app-text)">
                {freelancer.name}
              </Text>
              <Text fz="lg" c="dimmed">
                {freelancer.headline || freelancer.cvAnalysis?.bestRole || "Freelance specialist"}
              </Text>
              <Group gap="xs" wrap="wrap">
                {freelancer.experienceLevel && <Badge color="gray" variant="light">{freelancer.experienceLevel}</Badge>}
                {freelancer.country && <Badge color="blue" variant="light" leftSection={<MapPin size={12} />}>{freelancer.country}</Badge>}
                {freelancer.hourlyRate !== undefined && <Badge color="green" variant="light">${freelancer.hourlyRate}/hr</Badge>}
                {freelancer.availability && <Badge color="teal" variant="light">{freelancer.availability}</Badge>}
              </Group>
            </Stack>
          </Group>

          <Button
            component={Link}
            href={`/client/messages?with=${freelancer.id}`}
            leftSection={<Mail size={16} />}
            color="teal"
            radius="md"
          >
            Message Candidate
          </Button>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
        <Card withBorder radius="lg" p="lg" bg="var(--app-surface)" style={{ gridColumn: "span 2" }}>
          <Stack gap="md">
            <Group gap="xs">
              <ThemeIcon color="teal" variant="light" radius="md"><Sparkles size={18} /></ThemeIcon>
              <Text fw={800} c="var(--app-text)">Profile Overview</Text>
            </Group>
            <Text c="dimmed" style={{ lineHeight: 1.7 }}>
              {freelancer.about || "This freelancer has not added a full profile summary yet."}
            </Text>
            <Divider />
            <Group gap="xs" wrap="wrap">
              {freelancer.skills.map((skill) => (
                <Badge key={skill} color="cyan" variant="light" size="md">
                  {skill}
                </Badge>
              ))}
            </Group>
            {domains.length > 0 && (
              <Box>
                <Text fz="xs" c="dimmed" tt="uppercase" fw={700} mb={6}>Domain Knowledge</Text>
                <Group gap="xs" wrap="wrap">
                  {domains.slice(0, 10).map((domain) => (
                    <Badge key={domain} color="grape" variant="light" size="md">
                      {domain}
                    </Badge>
                  ))}
                </Group>
              </Box>
            )}
          </Stack>
        </Card>

        <Card withBorder radius="lg" p="lg" bg="var(--app-surface)">
          <Stack gap="md">
            <Group gap="xs">
              <ThemeIcon color="green" variant="light" radius="md"><DollarSign size={18} /></ThemeIcon>
              <Text fw={800} c="var(--app-text)">Hiring Snapshot</Text>
            </Group>
            <Box>
              <Text fz="xs" c="dimmed" tt="uppercase" fw={700}>Hourly Rate</Text>
              <Text fw={800} fz="xl" c="var(--app-text)">
                {freelancer.hourlyRate !== undefined ? `$${freelancer.hourlyRate}/hr` : "Not specified"}
              </Text>
            </Box>
            <Box>
              <Text fz="xs" c="dimmed" tt="uppercase" fw={700}>KBS Best Role</Text>
              <Text fw={700} c="var(--app-text)">
                {freelancer.cvAnalysis?.bestRole || "Not available"}
              </Text>
              {freelancer.cvAnalysis?.bestScore !== undefined && (
                <Text fz="sm" c="dimmed">{freelancer.cvAnalysis.bestScore}% confidence</Text>
              )}
            </Box>
            <Button component={Link} href={`/client/messages?with=${freelancer.id}`} fullWidth color="teal" leftSection={<Mail size={16} />}>
              Open Chat
            </Button>
          </Stack>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Card withBorder radius="lg" p="lg" bg="var(--app-surface)">
          <Stack gap="md">
            <Group gap="xs">
              <ThemeIcon color="indigo" variant="light" radius="md"><Briefcase size={18} /></ThemeIcon>
              <Text fw={800} c="var(--app-text)">Experience Evidence</Text>
            </Group>
            {experience.length === 0 ? (
              <Text fz="sm" c="dimmed">No CV experience evidence available.</Text>
            ) : (
              experience.slice(0, 4).map((item, index) => (
                <Card key={`${item.company}-${index}`} withBorder radius="md" p="sm">
                  <Text fw={700} c="var(--app-text)">{item.role || "Role"}</Text>
                  <Text fz="sm" c="dimmed">{item.company || "Company"}{item.years ? ` · ${item.years}` : ""}</Text>
                </Card>
              ))
            )}
          </Stack>
        </Card>

        <Card withBorder radius="lg" p="lg" bg="var(--app-surface)">
          <Stack gap="md">
            <Group gap="xs">
              <ThemeIcon color="violet" variant="light" radius="md"><Sparkles size={18} /></ThemeIcon>
              <Text fw={800} c="var(--app-text)">Portfolio & CV Projects</Text>
            </Group>
            {freelancer.portfolioLinks?.map((url) => (
              <Anchor key={url} href={url} target="_blank" rel="noreferrer" fz="sm">
                <Group gap={6}><ExternalLink size={14} />{url}</Group>
              </Anchor>
            ))}
            {cvProjects.length === 0 ? (
              <Text fz="sm" c="dimmed">No CV project evidence available.</Text>
            ) : (
              cvProjects.slice(0, 4).map((item, index) => (
                <Card key={`${item.name}-${index}`} withBorder radius="md" p="sm">
                  <Text fw={700} c="var(--app-text)">{item.name || "Project"}</Text>
                  <Group gap={6} mt={6} wrap="wrap">
                    {(item.technologies || []).slice(0, 6).map((tech) => (
                      <Badge key={tech} size="xs" color="violet" variant="light">{tech}</Badge>
                    ))}
                  </Group>
                </Card>
              ))
            )}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
