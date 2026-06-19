"use client";

import { useEffect, useState } from "react";
import { MultiSelect, type MultiSelectProps } from "@mantine/core";
import { skillApi } from "@/lib/api";

/**
 * A skills selector that fetches the skill library from the API
 * and only allows users to search & pick from it — no free-typing.
 *
 * Drop-in replacement for every `TagsInput` that was used for skills.
 */

interface SkillsSelectProps
  extends Omit<MultiSelectProps, "data" | "searchable"> {
  /** Extra static options to merge (e.g. AI-suggested skills) */
  extraOptions?: string[];
}

export function SkillsSelect({
  extraOptions = [],
  ...rest
}: SkillsSelectProps) {
  const [librarySkills, setLibrarySkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    skillApi
      .list()
      .then(({ skills }) => {
        if (!cancelled) {
          setLibrarySkills(skills.map((s) => s.name));
        }
      })
      .catch(() => {
        /* keep whatever we have */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Merge library skills, extra options, and currently-selected values
  // so that already-selected values always appear in the dropdown.
  const currentValue: string[] = Array.isArray(rest.value) ? rest.value : [];
  const data = Array.from(
    new Set([...librarySkills, ...extraOptions, ...currentValue]),
  );

  return (
    <MultiSelect
      {...rest}
      data={data}
      searchable
      nothingFoundMessage={loading ? "Loading skills…" : "No matching skill found"}
      placeholder={rest.placeholder ?? "Search and select skills"}
      filter={({ options, search }) => {
        const query = search.toLowerCase().trim();
        if (!query) return options;
        return options.filter((opt) => {
          const label =
            typeof opt === "string" ? opt : "label" in opt ? (opt.label as string) : "";
          return label.toLowerCase().includes(query);
        });
      }}
    />
  );
}
