"use client";

import { Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import { AlertTriangle, CheckCircle, Clock, Database, RefreshCw } from "lucide-react";

export type KbsSyncStatus = "not_synced" | "synced" | "outdated" | "failed";

export interface KbsSyncState {
  status: KbsSyncStatus;
  syncedAt?: string | Date;
  error?: string;
}

const STATUS_COPY: Record<
  KbsSyncStatus,
  { label: string; color: string; action: string; description: string }
> = {
  not_synced: {
    label: "Not synced",
    color: "gray",
    action: "Sync to KBS",
    description: "This data exists in MongoDB but has not been written to Neo4j yet.",
  },
  synced: {
    label: "Synced",
    color: "green",
    action: "Sync again",
    description: "Neo4j has the current graph copy and recommendations can use it.",
  },
  outdated: {
    label: "Outdated",
    color: "orange",
    action: "Re-sync to KBS",
    description: "The MongoDB data changed after the last sync, so Neo4j should be refreshed.",
  },
  failed: {
    label: "Failed",
    color: "red",
    action: "Retry sync",
    description: "The last sync attempt failed. Check Neo4j and retry.",
  },
};

function SyncIcon({ status }: { status: KbsSyncStatus }) {
  if (status === "synced") return <CheckCircle size={18} />;
  if (status === "failed") return <AlertTriangle size={18} />;
  if (status === "outdated") return <RefreshCw size={18} />;
  return <Clock size={18} />;
}

export function KbsSyncPanel({
  title,
  sync,
  syncing,
  onSync,
}: {
  title: string;
  sync?: KbsSyncState;
  syncing?: boolean;
  onSync: () => void | Promise<void>;
}) {
  const status = sync?.status || "not_synced";
  const copy = STATUS_COPY[status];
  const syncedAt = sync?.syncedAt ? new Date(sync.syncedAt).toLocaleString() : null;

  return (
    <Card withBorder radius="md" bg="var(--app-surface)">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            <Database size={20} color="var(--mantine-color-cyan-6)" />
            <Stack gap={2}>
              <Text fw={700} c="var(--app-text)">
                {title}
              </Text>
              <Text fz="sm" c="dimmed">
                {copy.description}
              </Text>
            </Stack>
          </Group>
          <Badge color={copy.color} variant="light" leftSection={<SyncIcon status={status} />}>
            {copy.label}
          </Badge>
        </Group>

        {syncedAt && (
          <Text fz="xs" c="dimmed">
            Last synced: {syncedAt}
          </Text>
        )}
        {status === "failed" && sync?.error && (
          <Text fz="xs" c="red">
            {sync.error}
          </Text>
        )}

        <Group justify="flex-end">
          <Button
            color="cyan"
            variant={status === "synced" ? "light" : "filled"}
            loading={syncing}
            leftSection={<RefreshCw size={16} />}
            onClick={onSync}
          >
            {copy.action}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
