"use client";

import {
  Box,
  Card,
  Text,
  Badge,
  Button,
  Group,
  Stack,
  SimpleGrid,
  ThemeIcon,
} from "@mantine/core";
import {
  Wallet,
  TrendingUp,
  Clock4,
  DollarSign,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import type { EarningsData } from "./types";

interface EarningsSectionProps {
  earnings: EarningsData;
}

export function EarningsSection({ earnings }: EarningsSectionProps) {

  const stats = [
    {
      label: "Total Earnings",
      value: `$${earnings.totalEarnings.toLocaleString()}`,
      icon: <Wallet size={20} />,
      color: "cyan",
      change: "+12%",
    },
    {
      label: "This Month",
      value: `$${earnings.thisMonth.toLocaleString()}`,
      icon: <TrendingUp size={20} />,
      color: "green",
      change: "+8%",
    },
    {
      label: "Pending",
      value: `$${earnings.pending.toLocaleString()}`,
      icon: <Clock4 size={20} />,
      color: "orange",
      change: "2 jobs",
    },
    {
      label: "Available",
      value: `$${earnings.available.toLocaleString()}`,
      icon: <DollarSign size={20} />,
      color: "blue",
      change: "Ready",
    },
  ];

  return (
    <Stack gap="xl">
      {/* Stats Row */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        {stats.map((stat) => (
          <Card key={stat.label} withBorder radius="md" shadow="sm">
            <Stack gap="sm">
              <Group justify="space-between">
                <ThemeIcon color={stat.color} variant="light" size={40} radius="md">
                  {stat.icon}
                </ThemeIcon>
                <Badge
                  size="sm"
                  variant="light"
                  color={stat.color}
                  leftSection={<ArrowUpRight size={12} />}
                >
                  {stat.change}
                </Badge>
              </Group>
              <Text fw={700} fz="xl" c="var(--app-text)">
                {stat.value}
              </Text>
              <Text fz="sm" c="var(--app-text)">
                {stat.label}
              </Text>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      {/* Monthly Overview */}
      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={700} c="var(--app-text)" fz="lg">
              Earnings Overview
            </Text>
            <Button variant="subtle" size="sm" color="gray">
              View Report
            </Button>
          </Group>
          <SimpleGrid cols={{ base: 3, sm: 6 }} spacing="md">
            {earnings.monthlyStats.map((m) => (
              <Card key={m.month} withBorder radius="md" p="sm" style={{ textAlign: "center" }}>
                <Text fw={700} fz="lg" c="var(--app-text)">
                  ${(m.earnings / 1000).toFixed(1)}k
                </Text>
                <Text fz="xs" c="var(--app-text)" mt={4}>
                  {m.month}
                </Text>
                <Box
                  mt={8}
                  style={{
                    height: 4,
                    background: "var(--app-border)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <Box
                    style={{
                      width: `${(m.earnings / 15000) * 100}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #06b6d4, #4f46e5)",
                      borderRadius: 2,
                    }}
                  />
                </Box>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      </Card>

      {/* Transactions */}
      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={700} c="var(--app-text)" fz="lg">
              Recent Transactions
            </Text>
            <Button variant="subtle" size="sm" color="gray">
              View All
            </Button>
          </Group>
          <Stack gap="xs">
            {earnings.transactions.map((tx) => (
              <Card key={tx.id} withBorder radius="sm" p="sm">
                <Group justify="space-between" align="flex-start">
                  <Group gap="sm" align="flex-start">
                    <ThemeIcon
                      color={tx.status === "completed" ? "green" : "orange"}
                      variant="light"
                      size={40}
                      radius="md"
                    >
                      {tx.status === "completed" ? (
                        <CheckCircle2 size={20} />
                      ) : (
                        <Clock4 size={20} />
                      )}
                    </ThemeIcon>
                    <Stack gap={2}>
                      <Text fw={600} c="var(--app-text)" fz="sm">
                        {tx.project}
                      </Text>
                      <Text fz="xs" c="var(--app-muted)">
                        {tx.client} · {tx.date}
                      </Text>
                    </Stack>
                  </Group>
                  <Stack gap={2} align="flex-end">
                    <Text fw={700} c="var(--app-text)" fz="md">
                      ${tx.amount.toLocaleString()}
                    </Text>
                    <Badge
                      size="sm"
                      variant="light"
                      color={tx.status === "completed" ? "green" : "orange"}
                    >
                      {tx.status}
                    </Badge>
                  </Stack>
                </Group>
              </Card>
            ))}
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}
