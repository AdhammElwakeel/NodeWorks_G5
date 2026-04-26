"use client";

import { Group, Title, Box } from "@mantine/core";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <Box mb="xl">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Box>
          <Title order={2} c="dark.9">
            {title}
          </Title>
          {subtitle && (
            <Box mt={4} c="dimmed" fz="sm">
              {subtitle}
            </Box>
          )}
        </Box>
        {actions && <Box mt={4}>{actions}</Box>}
      </Group>
    </Box>
  );
}
