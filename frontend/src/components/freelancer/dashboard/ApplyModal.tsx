"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  Card,
  Text,
  Group,
  Stack,
  Button,
  Textarea,
  NumberInput,
  ScrollArea,
} from "@mantine/core";
import { DollarSign } from "lucide-react";
import type { Job } from "./types";

interface ApplyModalProps {
  opened: boolean;
  onClose: () => void;
  job: Job | null;
}

export function ApplyModal({ opened, onClose, job }: ApplyModalProps) {

  const [coverLetter, setCoverLetter] = useState("");
  const [proposedRate, setProposedRate] = useState<string | number>("");

  useEffect(() => {
    if (job) {
      setCoverLetter("");
      setProposedRate(job.budgetType === "hourly" ? job.budget : job.budget);
    }
  }, [job]);

  function handleSubmit() {
    onClose();
    setCoverLetter("");
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Apply: ${job?.title || ""}`}
      size="lg"
      scrollAreaComponent={ScrollArea.Autosize}
      radius="md"
    >
      <Stack gap="md">
        {job && (
          <Card withBorder radius="md">
            <Stack gap={4}>
              <Text fw={600} c="black">
                {job.title}
              </Text>
              <Text fz="sm" c="black" lineClamp={3}>
                {job.description}
              </Text>
              {job.budget && (
                <Group gap={4}>
                  <DollarSign size={14} color="var(--mantine-color-cyan-6)" />
                  <Text fz="sm" fw={500} c="cyan.7">
                    Budget:{" "}
                    {job.budgetType === "hourly"
                      ? `$${job.budget}/hr`
                      : `$${job.budget.toLocaleString()}`}
                  </Text>
                </Group>
              )}
            </Stack>
          </Card>
        )}
        <Textarea
          label="Cover Letter"
          placeholder="Introduce yourself, explain why you're a great fit for this project, and highlight relevant experience..."
          minRows={6}
          required
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          radius="md"
        />
        <NumberInput
          label="Your Proposed Rate ($)"
          placeholder="Leave blank to match project budget"
          value={proposedRate}
          onChange={setProposedRate}
          radius="md"
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" radius="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="cyan"
            radius="md"
            onClick={handleSubmit}
            disabled={!coverLetter.trim()}
          >
            Submit Proposal
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
