"use client";

import { useState } from "react";
import {
  Modal,
  TextInput,
  Textarea,
  NumberInput,
  Button,
  Stack,
  Text,
  Group,
} from "@mantine/core";
import type { Job } from "./types";

interface ApplyModalProps {
  opened: boolean;
  onClose: () => void;
  job: Job | null;
  onSubmit: (data: {
    coverLetter: string;
    proposedRate: number;
    estimatedDuration?: string;
  }) => Promise<void>;
}

export function ApplyModal({ opened, onClose, job, onSubmit }: ApplyModalProps) {
  const [coverLetter, setCoverLetter] = useState("");
  const [proposedRate, setProposedRate] = useState<number | "">("");
  const [estimatedDuration, setEstimatedDuration] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!coverLetter.trim() || !proposedRate) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        coverLetter: coverLetter.trim(),
        proposedRate: Number(proposedRate),
        estimatedDuration: estimatedDuration.trim() || undefined,
      });
      setCoverLetter("");
      setProposedRate("");
      setEstimatedDuration("");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!job) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Text fw={700} fz="lg">
            Apply for Job
          </Text>
        </Group>
      }
      size="lg"
      radius="md"
    >
      <Stack gap="md">
        <Text fw={600} c="var(--app-text)">
          {job.title}
        </Text>
        {job.budget && (
          <Text fz="sm" c="dimmed">
            Budget: {job.budgetType === "hourly" ? `$${job.budget}/hr` : `$${job.budget.toLocaleString()}`}
          </Text>
        )}

        <Textarea
          label="Cover Letter"
          placeholder="Introduce yourself and explain why you're the best fit for this job..."
          required
          minRows={4}
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          styles={{ label: { fontWeight: 600 } }}
        />

        <NumberInput
          label="Proposed Rate (USD)"
          placeholder="e.g. 5000"
          required
          min={1}
          value={proposedRate}
          onChange={(val) => setProposedRate(val as number | "")}
          prefix="$"
          styles={{ label: { fontWeight: 600 } }}
        />

        <TextInput
          label="Estimated Duration"
          placeholder="e.g. 2 weeks"
          value={estimatedDuration}
          onChange={(e) => setEstimatedDuration(e.target.value)}
          styles={{ label: { fontWeight: 600 } }}
        />

        {error && (
          <Text c="red" fz="sm" ta="center">
            {error}
          </Text>
        )}

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            color="cyan"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!coverLetter.trim() || !proposedRate || submitting}
          >
            Submit Proposal
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
