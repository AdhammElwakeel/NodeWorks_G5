"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { ArrowUpRight, Mail, MessageSquare, Send, User } from "lucide-react";
import { freelancerApi, messageApi, type PublicFreelancerData } from "@/lib/api";
import { PageHeader } from "@/components/client/PageHeader";
import { useAuth } from "@/lib/auth-context";
import { notifications } from "@mantine/notifications";

type Conversation = {
  id: string;
  participants: { id: string; name: string; avatar?: string | null }[];
  lastMessage?: string;
  lastMessageAt?: string;
};

type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
};

function formatTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ClientMessagesContent() {
  const searchParams = useSearchParams();
  const selectedUserId = searchParams.get("with") || "";
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFreelancer, setSelectedFreelancer] = useState<PublicFreelancerData | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageApi
      .conversations()
      .then((data) => setConversations(data.conversations || []))
      .catch(() => setConversations([]))
      .finally(() => setLoadingConversations(false));
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      queueMicrotask(() => {
        setMessages([]);
        setSelectedFreelancer(null);
      });
      return;
    }

    queueMicrotask(() => {
      setLoadingThread(true);
      Promise.all([
        messageApi.getThread(selectedUserId),
        freelancerApi.get(selectedUserId).catch(() => ({ freelancer: null })),
      ])
      .then(([threadData, freelancerData]) => {
        setMessages(threadData.messages || []);
        setSelectedFreelancer(freelancerData.freelancer);
        messageApi.conversations().then((data) => setConversations(data.conversations || []));
      })
        .catch(() => {
          setMessages([]);
          setSelectedFreelancer(null);
        })
        .finally(() => setLoadingThread(false));
    });
  }, [selectedUserId]);

  useEffect(() => {
    queueMicrotask(() => {
      viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages]);

  const selectedConversationUser = useMemo(() => {
    if (!selectedUserId || !user) return null;
    const conversation = conversations.find((item) =>
      item.participants.some((participant) => participant.id === selectedUserId)
    );
    return conversation?.participants.find((participant) => participant.id !== user.id) || null;
  }, [conversations, selectedUserId, user]);

  const selectedName = selectedFreelancer?.name || selectedConversationUser?.name || "Freelancer";
  const selectedAvatar = selectedFreelancer?.avatar || selectedConversationUser?.avatar;

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!selectedUserId || !content.trim()) return;

    setSending(true);
    try {
      const data = await messageApi.send({ receiverId: selectedUserId, content: content.trim() });
      setMessages((current) => [...current, data.message]);
      setContent("");
      const refreshed = await messageApi.conversations();
      setConversations(refreshed.conversations || []);
    } catch (error: unknown) {
      notifications.show({ color: "red", title: "Message not sent", message: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSending(false);
    }
  }

  return (
    <Stack gap="xl">
      <PageHeader title="Client Inbox" subtitle="Continue conversations with recommended candidates and project applicants." />

      <Card withBorder radius="xl" p={0} bg="var(--app-surface)" style={{ overflow: "hidden" }}>
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "minmax(260px, 340px) minmax(0, 1fr)",
            minHeight: 640,
          }}
        >
          <Box style={{ borderRight: "1px solid var(--app-border)", background: "rgba(15,23,42,0.02)" }}>
            <Group justify="space-between" p="md">
              <Group gap="xs">
                <ThemeIcon color="teal" variant="light" radius="md">
                  <MessageSquare size={18} />
                </ThemeIcon>
                <Text fw={800} c="var(--app-text)">Conversations</Text>
              </Group>
              <Badge color="teal" variant="light">{conversations.length}</Badge>
            </Group>

            {loadingConversations ? (
              <Center py="xl"><Loader size="sm" color="teal" /></Center>
            ) : conversations.length === 0 ? (
              <Stack gap="xs" p="md">
                <Text fw={700} c="var(--app-text)">No conversations yet</Text>
                <Text fz="sm" c="dimmed">Open a recommended team member and start the first message.</Text>
              </Stack>
            ) : (
              <ScrollArea h={560}>
                <Stack gap={4} p="sm">
                  {conversations.map((conversation) => {
                    const other = conversation.participants.find((participant) => participant.id !== user?.id);
                    if (!other) return null;
                    const active = other.id === selectedUserId;

                    return (
                      <Card
                        key={conversation.id}
                        component={Link}
                        href={`/client/messages?with=${other.id}`}
                        withBorder={active}
                        radius="lg"
                        p="sm"
                        style={{
                          textDecoration: "none",
                          background: active ? "rgba(20,184,166,0.10)" : "transparent",
                          borderColor: active ? "rgba(20,184,166,0.35)" : "transparent",
                        }}
                      >
                        <Group wrap="nowrap" align="flex-start">
                          <Avatar size={42} radius="xl" src={other.avatar || undefined} color="teal">
                            <User size={20} />
                          </Avatar>
                          <Stack gap={3} style={{ minWidth: 0, flex: 1 }}>
                            <Group justify="space-between" gap="xs" wrap="nowrap">
                              <Text fw={700} c="var(--app-text)" lineClamp={1}>{other.name}</Text>
                              <Text fz={10} c="dimmed" style={{ flexShrink: 0 }}>{formatTime(conversation.lastMessageAt)}</Text>
                            </Group>
                            <Text fz="sm" c="dimmed" lineClamp={2}>{conversation.lastMessage || "Open conversation"}</Text>
                          </Stack>
                        </Group>
                      </Card>
                    );
                  })}
                </Stack>
              </ScrollArea>
            )}
          </Box>

          <Box style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            {!selectedUserId ? (
              <Center h="100%" p="xl">
                <Stack align="center" gap="sm">
                  <ThemeIcon size={58} radius="xl" color="teal" variant="light"><Mail size={28} /></ThemeIcon>
                  <Text fw={800} fz="lg" c="var(--app-text)">Select a conversation</Text>
                  <Text c="dimmed" ta="center" maw={360}>Choose a candidate from the left, or use Message from a recommended team member.</Text>
                </Stack>
              </Center>
            ) : (
              <>
                <Group justify="space-between" p="md" style={{ borderBottom: "1px solid var(--app-border)" }}>
                  <Group gap="sm">
                    <Avatar size={46} radius="xl" src={selectedAvatar || undefined} color="teal"><User size={22} /></Avatar>
                    <Stack gap={1}>
                      <Text fw={800} c="var(--app-text)">{selectedName}</Text>
                      <Text fz="sm" c="dimmed">{selectedFreelancer?.headline || selectedFreelancer?.cvAnalysis?.bestRole || "Candidate conversation"}</Text>
                    </Stack>
                  </Group>
                  <Button
                    component={Link}
                    href={`/client/freelancers/${selectedUserId}`}
                    variant="light"
                    color="teal"
                    rightSection={<ArrowUpRight size={15} />}
                  >
                    View Profile
                  </Button>
                </Group>

                <ScrollArea viewportRef={viewportRef} style={{ flex: 1 }} p="md">
                  {loadingThread ? (
                    <Center py="xl"><Loader size="sm" color="teal" /></Center>
                  ) : messages.length === 0 ? (
                    <Center py={80}>
                      <Stack align="center" gap="xs">
                        <Text fw={800} c="var(--app-text)">Start the conversation</Text>
                        <Text fz="sm" c="dimmed" ta="center">Introduce your project and ask about availability, rate, and next steps.</Text>
                      </Stack>
                    </Center>
                  ) : (
                    <Stack gap="md">
                      {messages.map((message) => {
                        const mine = message.senderId === user?.id;
                        return (
                          <Group key={message.id} justify={mine ? "flex-end" : "flex-start"}>
                            <Box
                              maw="70%"
                              p="sm"
                              style={{
                                borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                                background: mine ? "linear-gradient(135deg, #14b8a6, #0ea5e9)" : "var(--app-bg)",
                                color: mine ? "white" : "var(--app-text)",
                                border: mine ? "none" : "1px solid var(--app-border)",
                              }}
                            >
                              <Text fz="sm" style={{ whiteSpace: "pre-wrap" }}>{message.content}</Text>
                              <Text fz={10} mt={6} opacity={0.75}>{formatTime(message.createdAt)}</Text>
                            </Box>
                          </Group>
                        );
                      })}
                    </Stack>
                  )}
                </ScrollArea>

                <Box component="form" onSubmit={handleSend} p="md" style={{ borderTop: "1px solid var(--app-border)" }}>
                  <Group align="flex-end" wrap="nowrap">
                    <Textarea
                      value={content}
                      onChange={(event) => setContent(event.currentTarget.value)}
                      placeholder={`Message ${selectedName} about your project...`}
                      autosize
                      minRows={1}
                      maxRows={5}
                      style={{ flex: 1 }}
                    />
                    <Button type="submit" color="teal" loading={sending} disabled={!content.trim()} leftSection={<Send size={16} />}>
                      Send
                    </Button>
                  </Group>
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Card>
    </Stack>
  );
}

export default function ClientMessagesPage() {
  return (
    <Suspense fallback={<Center py={80}><Loader color="teal" /></Center>}>
      <ClientMessagesContent />
    </Suspense>
  );
}
