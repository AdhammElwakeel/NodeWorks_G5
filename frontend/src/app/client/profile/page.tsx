"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea,
  Select,
  Title,
  Avatar,
  Divider,
  Badge,
} from "@mantine/core";
import {
  Building2,
  Globe,
  Users,
  Mail,
  MapPin,
  Save,
  Edit3,
} from "lucide-react";
import { PageHeader } from "@/components/client/PageHeader";
import { useAuth } from "@/lib/auth-context";
import { notifications } from "@mantine/notifications";

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "E-commerce",
  "Education",
  "Marketing",
  "Real Estate",
  "Manufacturing",
  "Consulting",
  "Other",
];

const COMPANY_SIZES = [
  "1-10 employees",
  "11-50 employees",
  "51-200 employees",
  "201-500 employees",
  "500+ employees",
];

export default function ClientProfilePage() {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Mock profile data (would come from API in real app)
  const [profile, setProfile] = useState({
    companyName: "Acme Technologies",
    industry: "Technology",
    companySize: "11-50 employees",
    description:
      "We build innovative software solutions for businesses worldwide. Our team is always looking for talented freelancers to help us deliver exceptional projects.",
    website: "https://acmetech.com",
    location: "San Francisco, CA",
    email: user?.email || "contact@acmetech.com",
  });

  const [form, setForm] = useState({ ...profile });

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 800));
    setProfile({ ...form });
    setEditing(false);
    setSaving(false);
    notifications.show({
      title: "Profile updated",
      message: "Your company profile has been saved successfully.",
      color: "green",
    });
  };

  const handleCancel = () => {
    setForm({ ...profile });
    setEditing(false);
  };

  return (
    <Box>
      <PageHeader
        title="Company Profile"
        subtitle="Manage your company information"
        actions={
          !editing && (
            <Button
              variant="light"
              leftSection={<Edit3 size={16} />}
              onClick={() => setEditing(true)}
            >
              Edit Profile
            </Button>
          )
        }
      />

      <Card withBorder radius="md" bg="white">
        <Stack gap="xl">
          {/* Header */}
          <Group align="flex-start" gap="lg">
            <Avatar
              size={80}
              radius="xl"
              color="indigo"
              style={{
                background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
                border: "3px solid rgba(79,70,229,0.15)",
              }}
            >
              <Building2 size={36} color="white" />
            </Avatar>
            <Stack gap={4} style={{ flex: 1 }}>
              <Group gap="xs" align="center">
                <Title order={3} c="dark.9">
                  {profile.companyName}
                </Title>
                <Badge color="indigo" variant="light" size="sm">
                  {profile.industry}
                </Badge>
              </Group>
              <Group gap="xs">
                <Users size={14} color="#94a3b8" />
                <Text fz="sm" c="dimmed">
                  {profile.companySize}
                </Text>
              </Group>
              <Group gap="xs">
                <MapPin size={14} color="#94a3b8" />
                <Text fz="sm" c="dimmed">
                  {profile.location}
                </Text>
              </Group>
            </Stack>
          </Group>

          <Divider />

          {editing ? (
            <Stack gap="lg">
              <Group grow>
                <TextInput
                  label="Company Name"
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                  leftSection={<Building2 size={16} color="#94a3b8" />}
                  styles={{
                    label: {
                      color: "var(--mantine-color-dark-9)",
                      fontWeight: 600,
                    },
                  }}
                />
                <TextInput
                  label="Website"
                  value={form.website}
                  onChange={(e) =>
                    setForm({ ...form, website: e.target.value })
                  }
                  leftSection={<Globe size={16} color="#94a3b8" />}
                  styles={{
                    label: {
                      color: "var(--mantine-color-dark-9)",
                      fontWeight: 600,
                    },
                  }}
                />
              </Group>
              <Group grow>
                <Select
                  label="Industry"
                  data={INDUSTRIES}
                  value={form.industry}
                  onChange={(val) =>
                    setForm({ ...form, industry: val || "" })
                  }
                  styles={{
                    label: {
                      color: "var(--mantine-color-dark-9)",
                      fontWeight: 600,
                    },
                  }}
                />
                <Select
                  label="Company Size"
                  data={COMPANY_SIZES}
                  value={form.companySize}
                  onChange={(val) =>
                    setForm({ ...form, companySize: val || "" })
                  }
                  styles={{
                    label: {
                      color: "var(--mantine-color-dark-9)",
                      fontWeight: 600,
                    },
                  }}
                />
              </Group>
              <TextInput
                label="Location"
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
                leftSection={<MapPin size={16} color="#94a3b8" />}
                styles={{
                  label: {
                    color: "var(--mantine-color-dark-9)",
                    fontWeight: 600,
                  },
                }}
              />
              <TextInput
                label="Contact Email"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                leftSection={<Mail size={16} color="#94a3b8" />}
                styles={{
                  label: {
                    color: "var(--mantine-color-dark-9)",
                    fontWeight: 600,
                  },
                }}
              />
              <Textarea
                label="Company Description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                minRows={4}
                styles={{
                  label: {
                    color: "var(--mantine-color-dark-9)",
                    fontWeight: 600,
                  },
                }}
              />
              <Group justify="flex-end" gap="sm">
                <Button variant="default" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  variant="gradient"
                  gradient={{ from: "indigo", to: "cyan", deg: 135 }}
                  leftSection={<Save size={16} />}
                  onClick={handleSave}
                  loading={saving}
                >
                  Save Changes
                </Button>
              </Group>
            </Stack>
          ) : (
            <Stack gap="lg">
              <Group>
                <Globe size={18} color="#4f46e5" />
                <Text c="dark.9" fz="sm">
                  {profile.website}
                </Text>
              </Group>
              <Group>
                <Mail size={18} color="#4f46e5" />
                <Text c="dark.9" fz="sm">
                  {profile.email}
                </Text>
              </Group>

              <Divider />

              <Box>
                <Text fw={600} c="dark.9" mb="xs">
                  About
                </Text>
                <Text c="dimmed" fz="sm" style={{ lineHeight: 1.7 }}>
                  {profile.description}
                </Text>
              </Box>

              <Divider />

              <Group gap="sm">
                <Badge size="lg" variant="light" color="indigo">
                  {profile.industry}
                </Badge>
                <Badge size="lg" variant="light" color="cyan">
                  {profile.companySize}
                </Badge>
              </Group>
            </Stack>
          )}
        </Stack>
      </Card>
    </Box>
  );
}
