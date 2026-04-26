"use client";

import { Badge } from "@mantine/core";

interface StatusBadgeProps {
  status: "open" | "closed" | "pending";
  size?: string;
}

const config = {
  open: { color: "green", label: "Open" },
  closed: { color: "gray", label: "Closed" },
  pending: { color: "yellow", label: "Pending" },
} as const;

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const c = config[status] ?? config.closed;
  return (
    <Badge color={c.color} variant="light" size={size} radius="sm">
      {c.label}
    </Badge>
  );
}
