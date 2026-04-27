"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Center, Loader } from "@mantine/core";

export default function ProjectProposalsRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (id) router.replace(`/client/projects/${id}`);
  }, [id, router]);

  return (
    <Center py="xl">
      <Loader size="sm" />
    </Center>
  );
}