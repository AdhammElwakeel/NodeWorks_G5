"use client";

import { Group, Badge } from "@mantine/core";

interface SkillsTagsProps {
  skills: string[];
  size?: string;
}

export function SkillsTags({ skills, size = "xs" }: SkillsTagsProps) {
  return (
    <Group gap={6} wrap="wrap">
      {skills.map((skill) => (
        <Badge
          key={skill}
          size={size}
          variant="default"
          color="indigo"
          radius="sm"
          styles={{
            root: {
              textTransform: "none",
              fontWeight: 500,
            },
          }}
        >
          {skill}
        </Badge>
      ))}
    </Group>
  );
}
