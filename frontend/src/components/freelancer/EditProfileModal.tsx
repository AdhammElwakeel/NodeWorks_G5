"use client";

import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  NumberInput,
  Select,
  TagsInput,
  Group,
  Button,
  ScrollArea,
} from "@mantine/core";

interface EditProfileModalProps {
  opened: boolean;
  onClose: () => void;
  formData: {
    name: string;
    headline: string;
    about: string;
    country: string;
    hourlyRate: string | number;
    experienceLevel: string;
    availability: string;
    skills: string[];
    portfolioLinks: string[];
  };
  onFormChange: (data: Partial<EditProfileModalProps["formData"]>) => void;
  onSave: () => void;
  saving: boolean;
}

export function EditProfileModal({
  opened,
  onClose,
  formData,
  onFormChange,
  onSave,
  saving,
}: EditProfileModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Edit Your Profile"
      size="xl"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="md">
        <TextInput
          label="Full Name"
          placeholder="Your name"
          value={formData.name}
          onChange={(e) => onFormChange({ name: e.target.value })}
        />
        <TextInput
          label="Professional Headline"
          placeholder="e.g. Full-stack React & Node.js Developer"
          value={formData.headline}
          onChange={(e) => onFormChange({ headline: e.target.value })}
        />
        <Textarea
          label="About You"
          placeholder="Describe your experience, expertise, and what you can deliver for clients..."
          minRows={4}
          value={formData.about}
          onChange={(e) => onFormChange({ about: e.target.value })}
        />
        <Group grow>
          <Select
            label="Experience Level"
            data={["Junior", "Mid-level", "Senior", "Lead"]}
            value={formData.experienceLevel}
            onChange={(v) => onFormChange({ experienceLevel: v || "" })}
          />
          <TextInput
            label="Country"
            placeholder="Egypt"
            value={formData.country}
            onChange={(e) => onFormChange({ country: e.target.value })}
          />
        </Group>
        <Group grow>
          <NumberInput
            label="Hourly Rate ($)"
            placeholder="e.g. 50"
            value={formData.hourlyRate}
            onChange={(v) =>
              onFormChange({
                hourlyRate: typeof v === "number" ? v : "",
              })
            }
          />
          <Select
            label="Availability"
            data={["Full-time", "Part-time", "As needed", "Not available"]}
            value={formData.availability}
            onChange={(v) => onFormChange({ availability: v || "" })}
          />
        </Group>
        <TagsInput
          label="Skills"
          placeholder="Add skills and press Enter"
          data={[
            "React",
            "Next.js",
            "Node.js",
            "TypeScript",
            "Python",
            "UI Design",
            "Project Management",
            "Data Analysis",
            "Content Writing",
            "Mobile Development",
          ]}
          value={formData.skills}
          onChange={(v) => onFormChange({ skills: v })}
        />
        <TagsInput
          label="Portfolio Links"
          placeholder="Add URLs and press Enter"
          value={formData.portfolioLinks}
          onChange={(v) => onFormChange({ portfolioLinks: v })}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color="cyan" onClick={onSave} loading={saving}>
            Save Changes
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
