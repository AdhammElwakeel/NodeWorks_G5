"use client";

import {
  Modal,
  Stack,
  Card,
  Text,
  Group,
  Textarea,
  NumberInput,
  Button,
  ScrollArea,
} from "@mantine/core";
import { DollarSign } from "lucide-react";

interface ApplyModalProps {
  opened: boolean;
  onClose: () => void;
  project: any;
  coverLetter: string;
  proposedRate: string | number;
  onCoverLetterChange: (value: string) => void;
  onRateChange: (value: string | number) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function ApplyModal({
  opened,
  onClose,
  project,
  coverLetter,
  proposedRate,
  onCoverLetterChange,
  onRateChange,
  onSubmit,
  submitting,
}: ApplyModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Apply: ${project?.title || ""}`}
      size="lg"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="md">
        {project && (
          <Card withBorder radius="md" bg="gray.0">
            <Stack gap={4}>
              <Text fw={600} c="dark.9">
                {project.title}
              </Text>
              <Text fz="sm" c="dimmed" lineClamp={3}>
                {project.description}
              </Text>
              {project.budget && (
                <Group gap={4}>
                  <DollarSign size={14} color="var(--mantine-color-cyan-6)" />
                  <Text fz="sm" fw={500} c="cyan.7">
                    Budget: ${project.budget}{" "}
                    {project.budgetType === "hourly" ? "/hr" : " fixed"}
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
          onChange={(e) => onCoverLetterChange(e.target.value)}
        />

        <NumberInput
          label="Your Proposed Rate ($)"
          placeholder="Leave blank to match project budget"
          value={proposedRate}
          onChange={onRateChange}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="cyan"
            onClick={onSubmit}
            loading={submitting}
            disabled={!coverLetter.trim()}
          >
            Submit Proposal
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
