"use client";

import { Box, Container, Group, Stack, Title, Text, Badge, Button, Avatar, SimpleGrid, Card, ThemeIcon } from "@mantine/core";
import { User, MapPin, DollarSign, Clock, Briefcase, CheckCircle2, Clock4, Star, TrendingUp, Edit3 } from "lucide-react";
import Link from "next/link";
import type { Profile } from "./types";

interface HeaderBannerProps {
  profile: Profile;
  profileCompletion: number;
  acceptedCount: number;
  pendingCount: number;
  proposalsCount: number;
}

export function HeaderBanner({ profile, profileCompletion, acceptedCount, pendingCount, proposalsCount }: HeaderBannerProps) {
  const stats = [
    { icon: <Briefcase size={20} />, label: "Proposals", value: proposalsCount, color: "blue" },
    { icon: <CheckCircle2 size={20} />, label: "Accepted", value: acceptedCount, color: "green" },
    { icon: <Star size={20} />, label: "Profile Score", value: `${profileCompletion}%`, color: "yellow" },
    { icon: <TrendingUp size={20} />, label: "Active Jobs", value: acceptedCount, color: "cyan" },
  ];

  return (
    <Box
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        padding: "48px 0 32px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        style={{
          position: "absolute",
          top: "-60px",
          right: "15%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)",
        }}
      />
      <Box
        style={{
          position: "absolute",
          bottom: "-40px",
          left: "10%",
          width: 250,
          height: 250,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
        }}
      />

      <Container size="xl" style={{ position: "relative", zIndex: 1 }}>
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Group gap="xl" align="flex-start" wrap="wrap">
            <Box style={{ position: "relative" }}>
              <Avatar
                size={100}
                radius="xl"
                color="cyan"
                style={{
                  border: "4px solid rgba(6,182,212,0.3)",
                  boxShadow: "0 8px 32px rgba(6,182,212,0.25)",
                }}
              >
                <User size={52} strokeWidth={1.5} />
              </Avatar>
              <Box
                style={{
                  position: "absolute",
                  bottom: 4,
                  right: 4,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#22c55e",
                  border: "3px solid #0f172a",
                }}
              />
            </Box>
            <Stack gap={6}>
              <Group gap="sm">
                <Title order={2} c="white" fw={700}>
                  {profile.name}
                </Title>
                <Badge color="cyan" variant="light" size="lg">
                  {profile.role}
                </Badge>
              </Group>
              <Text c="gray.3" fz="lg" fw={500}>
                {profile.headline}
              </Text>
              <Group gap="lg" mt={4}>
                <Group gap={4}>
                  <MapPin size={14} color="var(--app-muted-soft)" />
                  <Text c="gray.4" fz="sm">
                    {profile.country}
                  </Text>
                </Group>
                <Group gap={4}>
                  <DollarSign size={14} color="var(--app-muted-soft)" />
                  <Text c="gray.4" fz="sm">
                    ${profile.hourlyRate}/hr
                  </Text>
                </Group>
                <Group gap={4}>
                  <Clock size={14} color="var(--app-muted-soft)" />
                  <Text c="gray.4" fz="sm">
                    {profile.availability}
                  </Text>
                </Group>
              </Group>
            </Stack>
          </Group>

          <Stack gap="sm" align="flex-end">
            <Button
              component={Link}
              href="/freelancer/profile/edit"
              color="cyan"
              variant="light"
              leftSection={<Edit3 size={16} />}
            >
              Edit Profile
            </Button>
            <Group gap="xs">
              <Badge color="green" variant="light" size="sm">
                <Group gap={4}>
                  <CheckCircle2 size={12} />
                  {acceptedCount} Hired
                </Group>
              </Badge>
              <Badge color="orange" variant="light" size="sm">
                <Group gap={4}>
                  <Clock4 size={12} />
                  {pendingCount} Pending
                </Group>
              </Badge>
            </Group>
          </Stack>
        </Group>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
          {stats.map((stat) => (
            <Card
              key={stat.label}
              bg="rgba(255,255,255,0.04)"
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(8px)",
              }}
              radius="md"
              p="sm"
            >
              <Group gap="sm">
                <ThemeIcon
                  color={stat.color}
                  variant="light"
                  size={36}
                  radius="md"
                  style={{ background: "rgba(255,255,255,0.06)", color: "white" }}
                >
                  {stat.icon}
                </ThemeIcon>
                <Stack gap={2}>
                  <Text fw={700} fz="xl" c="white">
                    {stat.value}
                  </Text>
                  <Text fz="xs" c="gray.4">
                    {stat.label}
                  </Text>
                </Stack>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );
}
