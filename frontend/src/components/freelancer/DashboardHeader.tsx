"use client";

import {
  Box,
  Container,
  Group,
  Stack,
  Text,
  Title,
  Avatar,
  Badge,
  Button,
  Card,
  SimpleGrid,
  ThemeIcon,
} from "@mantine/core";
import {
  User,
  MapPin,
  DollarSign,
  Clock,
  Briefcase,
  CheckCircle2,
  Clock4,
  Star,
  TrendingUp,
  Edit3,
} from "lucide-react";

interface DashboardHeaderProps {
  profile: any;
  proposals: any[];
  onEditClick: () => void;
}

export function DashboardHeader({
  profile,
  proposals,
  onEditClick,
}: DashboardHeaderProps) {
  const fp = profile?.freelancerProfile;
  const acceptedCount = proposals.filter((p) => p.status === "accepted").length;
  const pendingCount = proposals.filter((p) => p.status === "pending").length;

  return (
    <Box
      style={{
        background:
          "linear-gradient(135deg, #1e3a5f 0%, #0f172a 50%, #1e293b 100%)",
        padding: "48px 0 32px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        style={{
          position: "absolute",
          top: "-60px",
          right: "10%",
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "rgba(6, 182, 212, 0.08)",
        }}
      />
      <Box
        style={{
          position: "absolute",
          bottom: "-40px",
          left: "5%",
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: "rgba(99, 102, 241, 0.06)",
        }}
      />

      <Container size="xl" style={{ position: "relative", zIndex: 1 }}>
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Group gap="xl" align="flex-start" wrap="wrap">
            <Avatar
              size={100}
              radius="xl"
              color="cyan"
              style={{
                border: "4px solid rgba(255,255,255,0.15)",
                boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
              }}
            >
              <User size={48} strokeWidth={1.5} />
            </Avatar>
            <Stack gap={6}>
              <Group gap="sm">
                <Title order={2} c="white" fw={700}>
                  {profile?.name || "Your Name"}
                </Title>
                <Badge color="cyan" variant="light" size="lg">
                  {fp?.experienceLevel || "New Freelancer"}
                </Badge>
              </Group>
              <Text c="gray.3" fz="lg" fw={500}>
                {fp?.headline || "Add your professional headline"}
              </Text>
              <Group gap="lg" mt={4}>
                {fp?.country && (
                  <Group gap={4}>
                    <MapPin size={14} color="#94a3b8" />
                    <Text c="gray.4" fz="sm">
                      {fp.country}
                    </Text>
                  </Group>
                )}
                {fp?.hourlyRate && (
                  <Group gap={4}>
                    <DollarSign size={14} color="#94a3b8" />
                    <Text c="gray.4" fz="sm">
                      ${fp.hourlyRate}/hr
                    </Text>
                  </Group>
                )}
                {fp?.availability && (
                  <Group gap={4}>
                    <Clock size={14} color="#94a3b8" />
                    <Text c="gray.4" fz="sm">
                      {fp.availability}
                    </Text>
                  </Group>
                )}
              </Group>
            </Stack>
          </Group>

          <Stack gap="sm" align="flex-end">
            <Button
              color="cyan"
              variant="light"
              leftSection={<Edit3 size={16} />}
              onClick={onEditClick}
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
          {[
            { icon: <Briefcase size={20} />, label: "Proposals", value: proposals.length, color: "blue" },
            { icon: <CheckCircle2 size={20} />, label: "Accepted", value: acceptedCount, color: "green" },
            { icon: <Star size={20} />, label: "Profile Score", value: "75%", color: "yellow" },
            { icon: <TrendingUp size={20} />, label: "Active Jobs", value: acceptedCount, color: "cyan" },
          ].map((stat) => (
            <Card
              key={stat.label}
              bg="rgba(255,255,255,0.06)"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              radius="md"
              p="sm"
            >
              <Group gap="sm">
                <ThemeIcon
                  color={stat.color}
                  variant="light"
                  size={36}
                  radius="md"
                  style={{ background: "rgba(255,255,255,0.08)", color: "white" }}
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
