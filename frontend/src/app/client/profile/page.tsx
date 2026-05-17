"use client";

import { useState, useEffect } from "react";
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
  Loader,
  Center,
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
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth-context";
import { profileApi } from "@/lib/api";
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

interface ClientProfileData {
  companyName: string;
  industry: string;
  companySize: string;
  description: string;
  website: string;
  location: string;
}

export default function ClientProfilePage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<ClientProfileData>({
    companyName: "",
    industry: "",
    companySize: "",
    description: "",
    website: "",
    location: "",
  });

  const [form, setForm] = useState<ClientProfileData>({ ...profile });

  useEffect(() => {
    if (!user) return;
    const cp = (user as any).clientProfile || {};
    const p = {
      companyName: cp.companyName || user.name || "",
      industry: cp.industry || "",
      companySize: cp.companySize || "",
      description: cp.description || "",
      website: cp.website || "",
      location: cp.location || "",
    };
    setProfile(p);
    setForm(p);
    setLoading(false);
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await profileApi.update({
        name: form.companyName,
        profile: {
          companyName: form.companyName,
          industry: form.industry,
          companySize: form.companySize,
          description: form.description,
          website: form.website,
          location: form.location,
        },
      });
      await refreshUser();
      setProfile({ ...form });
      setEditing(false);
      notifications.show({
        title: "Profile updated",
        message: "Your company profile has been saved.",
        color: "green",
      });
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to save profile.",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({ ...profile });
    setEditing(false);
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole="client">
        <Center style={{ minHeight: "80vh" }}>
          <Loader size="lg" color="indigo" />
        </Center>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRole="client">
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

      <Card withBorder radius="md" bg="var(--app-surface)">
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
                <Title order={3} c="var(--app-text-strong)">
                  {profile.companyName || "Your Company"}
                </Title>
                {profile.industry && (
                  <Badge color="indigo" variant="light" size="sm">
                    {profile.industry}
                  </Badge>
                )}
              </Group>
              {profile.companySize && (
                <Group gap="xs">
                  <Users size={14} color="var(--app-muted-soft)" />
                  <Text fz="sm" c="dimmed">
                    {profile.companySize}
                  </Text>
                </Group>
              )}
              {profile.location && (
                <Group gap="xs">
                  <MapPin size={14} color="var(--app-muted-soft)" />
                  <Text fz="sm" c="dimmed">
                    {profile.location}
                  </Text>
                </Group>
              )}
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
                  leftSection={<Building2 size={16} color="var(--app-muted-soft)" />}
                  styles={{
                    label: { color: "var(--app-text)", fontWeight: 600 },
                  }}
                />
                <TextInput
                  label="Website"
                  value={form.website}
                  onChange={(e) =>
                    setForm({ ...form, website: e.target.value })
                  }
                  leftSection={<Globe size={16} color="var(--app-muted-soft)" />}
                  styles={{
                    label: { color: "var(--app-text)", fontWeight: 600 },
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
                    label: { color: "var(--app-text)", fontWeight: 600 },
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
                    label: { color: "var(--app-text)", fontWeight: 600 },
                  }}
                />
              </Group>
              <TextInput
                label="Location"
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
                leftSection={<MapPin size={16} color="var(--app-muted-soft)" />}
                styles={{
                  label: { color: "var(--app-text)", fontWeight: 600 },
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
                  label: { color: "var(--app-text)", fontWeight: 600 },
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
              {profile.website && (
                <Group>
                  <Globe size={18} color="#4f46e5" />
                  <Text c="var(--app-text)" fz="sm">
                    {profile.website}
                  </Text>
                </Group>
              )}
              {user?.email && (
                <Group>
                  <Mail size={18} color="#4f46e5" />
                  <Text c="var(--app-text)" fz="sm">
                    {user.email}
                  </Text>
                </Group>
              )}

              {profile.description && (
                <>
                  <Divider />
                  <Box>
                    <Text fw={600} c="var(--app-text)" mb="xs">
                      About
                    </Text>
                    <Text c="dimmed" fz="sm" style={{ lineHeight: 1.7 }}>
                      {profile.description}
                    </Text>
                  </Box>
                </>
              )}

              {(profile.industry || profile.companySize) && (
                <>
                  <Divider />
                  <Group gap="sm">
                    {profile.industry && (
                      <Badge size="lg" variant="light" color="indigo">
                        {profile.industry}
                      </Badge>
                    )}
                    {profile.companySize && (
                      <Badge size="lg" variant="light" color="cyan">
                        {profile.companySize}
                      </Badge>
                    )}
                  </Group>
                </>
              )}
            </Stack>
          )}
        </Stack>
      </Card>
    </ProtectedRoute>
  );
}
