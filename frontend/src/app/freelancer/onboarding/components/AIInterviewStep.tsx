"use client";

import {
  Card,
  Alert,
  Button,
  Group,
  List,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { Briefcase, Cpu } from "lucide-react";
import { BACKEND_MISMATCH_NOTICE } from "@/lib/backend-features";

export function AIInterviewStep() {
  return (
    <Paper withBorder radius="md" p="lg" bg="var(--app-surface)">
      <Stack gap="lg">
        <Group>
          <ThemeIcon size={46} radius="md" color="cyan" variant="light">
            <Cpu size={24} />
          </ThemeIcon>
          <Stack gap={0}>
            <Title order={3} c="var(--app-text-strong)">
              AI interview
            </Title>
            <Text c="var(--app-text)" fz="sm">
              Complete your interview readiness step.
            </Text>
          </Stack>
        </Group>

        <Card withBorder radius="md" p="md" bg="var(--app-active-bg)">
          <Stack gap={6}>
            <Text fw={700} c="var(--app-text)">
              Interview preview
            </Text>
            <Text fz="sm" c="var(--app-text)">
              Duration: 12 minutes | 8 adaptive questions | Soft skills +
              technical communication
            </Text>
            <Text fz="sm" c="var(--app-text)">
              Status: disabled until the interview backend endpoint is restored
            </Text>
          </Stack>
        </Card>

        <Alert color="orange" radius="md" title="Interview action disabled">
          {BACKEND_MISMATCH_NOTICE}
        </Alert>

        <Button disabled color="cyan" variant="filled">
          Start AI interview
        </Button>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Card withBorder radius="md" p="md">
            <Group mb={4}>
              <Briefcase size={16} />
              <Text fw={600} c="var(--app-text)">
                What this validates
              </Text>
            </Group>
            <List spacing={4} fz="sm" c="var(--app-text)">
              <List.Item>Communication clarity</List.Item>
              <List.Item>Problem solving approach</List.Item>
              <List.Item>Client collaboration style</List.Item>
            </List>
          </Card>

          <Card withBorder radius="md" p="md">
            <Text fw={600} c="var(--app-text)" mb={4}>
              Score snapshot
            </Text>
            <List spacing={4} fz="sm" c="var(--app-text)">
              <List.Item>Communication: unavailable</List.Item>
              <List.Item>Technical confidence: unavailable</List.Item>
              <List.Item>Client fit: unavailable</List.Item>
            </List>
          </Card>
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}
