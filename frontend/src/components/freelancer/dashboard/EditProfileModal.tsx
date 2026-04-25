"use client";

import {
  Modal,
  Text,
  Stack,
  Group,
  Button,
  TextInput,
  Textarea,
  NumberInput,
  Select,
  TagsInput,
  ScrollArea,
  useMantineColorScheme,
} from "@mantine/core";
import type { EditFormState } from "./types";

interface EditProfileModalProps {
  opened: boolean;
  onClose: () => void;
  form: EditFormState;
  setForm: React.Dispatch<React.SetStateAction<EditFormState>>;
  onSave: () => void;
}

export function EditProfileModal({ opened, onClose, form, setForm, onSave }: EditProfileModalProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";
  const textPrimary = isDark ? "gray.0" : "black";
  const labelColor = isDark ? "#e2e8f0" : "black";

  const labelStyles = { label: { color: labelColor } };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text c={textPrimary} fw={700}>Edit Your Profile</Text>}
      size="xl"
      scrollAreaComponent={ScrollArea.Autosize}
      radius="md"
    >
      <Stack gap="md">
        <TextInput
          label="Full Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          radius="md"
          styles={labelStyles}
        />
        <TextInput
          label="Professional Headline"
          value={form.headline}
          onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
          radius="md"
          styles={labelStyles}
        />
        <Textarea
          label="About You"
          minRows={5}
          value={form.about}
          onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
          radius="md"
          styles={labelStyles}
        />
        <Group grow>
          <Select
            label="Experience Level"
            data={["Junior", "Mid-level", "Senior", "Lead"]}
            value={form.experienceLevel}
            onChange={(v) => setForm((f) => ({ ...f, experienceLevel: v || "" }))}
            radius="md"
            styles={labelStyles}
          />
          <TextInput
            label="Country"
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            radius="md"
            styles={labelStyles}
          />
        </Group>
        <Group grow>
          <NumberInput
            label="Hourly Rate ($)"
            value={form.hourlyRate}
            onChange={(v) =>
              setForm((f) => ({ ...f, hourlyRate: typeof v === "number" ? v : 0 }))
            }
            radius="md"
            styles={labelStyles}
          />
          <Select
            label="Availability"
            data={["Full-time", "Part-time", "As needed", "Not available"]}
            value={form.availability}
            onChange={(v) => setForm((f) => ({ ...f, availability: v || "" }))}
            radius="md"
            styles={labelStyles}
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
          value={form.skills}
          onChange={(v) => setForm((f) => ({ ...f, skills: v }))}
          radius="md"
          styles={labelStyles}
        />
        <TagsInput
          label="Portfolio Links"
          placeholder="Add URLs and press Enter"
          value={form.portfolioLinks}
          onChange={(v) => setForm((f) => ({ ...f, portfolioLinks: v }))}
          radius="md"
          styles={labelStyles}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" radius="md" onClick={onClose}>
            Cancel
          </Button>
          <Button color="cyan" radius="md" onClick={onSave}>
            Save Changes
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
