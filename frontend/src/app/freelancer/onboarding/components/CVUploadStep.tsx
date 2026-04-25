"use client";

import { Card, FileInput, Group, Stack, Text, ThemeIcon, Title, Badge } from "@mantine/core";
import { FileText } from "lucide-react";
import { Paper } from "@mantine/core";

const fieldLabelStyles = {
  label: { color: "var(--mantine-color-dark-9)", fontWeight: 600 },
  required: { color: "var(--mantine-color-dark-9)" },
  input: { color: "var(--mantine-color-dark-9)" },
};

interface CVUploadStepProps {
  cvExtracted: boolean;
  cvFileName: string | null;
  onUpload: (file: File | null) => void;
}

export function CVUploadStep({ cvExtracted, cvFileName, onUpload }: CVUploadStepProps) {
  return (
    <Paper withBorder radius="md" p="lg" bg="white">
      <Stack gap="lg">
        <Group>
          <ThemeIcon size={46} radius="md" color="blue" variant="light">
            <FileText size={24} />
          </ThemeIcon>
          <Stack gap={0}>
            <Title order={3} c="dark.9">
              CV extraction
            </Title>
            <Text c="dark.9" fz="sm">
              Upload PDF or DOCX and extract profile details.
            </Text>
          </Stack>
        </Group>

        <FileInput
          label="Upload your CV"
          placeholder="Select your CV file"
          accept=".pdf,.doc,.docx"
          onChange={onUpload}
          size="md"
          styles={fieldLabelStyles}
        />

        <Card withBorder radius="md" p="md" bg={cvExtracted ? "cyan.0" : "white"}>
          <Stack gap={8}>
            <Group justify="space-between">
              <Text fw={600} c="dark.9">
                CV upload status
              </Text>
              <Badge
                color={cvExtracted ? "cyan" : "gray"}
                variant="light"
              >
                {cvExtracted ? "Ready" : "Pending"}
              </Badge>
            </Group>
            <Text fz="sm" c="dark.9">
              {cvExtracted
                ? `Your CV (${cvFileName}) has been uploaded successfully and will be processed.`
                : "Upload your CV to continue to the next step."}
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Paper>
  );
}
