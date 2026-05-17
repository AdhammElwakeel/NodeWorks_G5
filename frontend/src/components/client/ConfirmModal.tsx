"use client";

import { Modal, Text, Button, Group, Stack } from "@mantine/core";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmColor?: string;
  loading?: boolean;
}

export function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  confirmColor = "red",
  loading,
}: ConfirmModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered size="sm">
      <Stack gap="lg">
        <Group gap="sm" align="flex-start">
          <AlertTriangle size={24} color="#ef4444" />
          <Text c="var(--app-text)" fz="sm" style={{ flex: 1 }}>
            {description}
          </Text>
        </Group>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color={confirmColor} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
