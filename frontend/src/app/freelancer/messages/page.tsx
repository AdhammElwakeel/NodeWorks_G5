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
  Container,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { ArrowLeft, Building2, Mail, MessageSquare, Send } from "lucide-react";
import { Sidebar } from "@/components/freelancer/dashboard";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { messageApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { notifications } from "@mantine/notifications";

type Conversation = {
  id: string;
  participants: { id: string; name: string; avatar?: string | null }[];
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
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

function FreelancerMessagesContent() {
  const searchParams = useSearchParams();
  const selectedUserId = searchParams.get("with") || "";
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      messageApi
        .conversations()
        .then((data) => {
          if (!cancelled) setConversations(data.conversations || []);
        })
        .catch(() => {
          if (!cancelled) setConversations([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingConversations(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!selectedUserId) {
      queueMicrotask(() => {
        if (!cancelled) setMessages([]);
      });
      return;
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setLoadingThread(true);
      messageApi
        .getThread(selectedUserId)
        .then((data) => {
          if (cancelled) return;
          setMessages(data.messages || []);
          refreshConversations().finally(() => {
            window.dispatchEvent(new Event("messages:read"));
          });
        })
        .catch(() => {
          if (!cancelled) setMessages([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingThread(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  useEffect(() => {
    queueMicrotask(() => {
      viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" });
    });
  }, [messages]);

  const selectedClient = useMemo(() => {
    if (!selectedUserId || !user) return null;
    const conversation = conversations.find((item) =>
      item.participants.some((participant) => participant.id === selectedUserId)
    );
    return conversation?.participants.find((participant) => participant.id !== user.id) || null;
  }, [conversations, selectedUserId, user]);

  const selectedName = selectedClient?.name || "Client";

  async function refreshConversations() {
    const data = await messageApi.conversations();
    setConversations(data.conversations || []);
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!selectedUserId || !content.trim()) return;

    setSending(true);
    try {
      const data = await messageApi.send({ receiverId: selectedUserId, content: content.trim() });
      setMessages((current) => [...current, data.message]);
      setContent("");
      await refreshConversations();
    } catch (error: unknown) {
      notifications.show({
        color: "red",
        title: "Message not sent",
        message: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setSending(false);
    }
  }

  const sidebar = <Sidebar activeSection="inbox" onSectionChange={() => {}} />;

  return (
    <ProtectedRoute requiredRole="freelancer">
      <Box style={{ display: "flex", minHeight: "100vh" }}>
      <Box visibleFrom="md" style={{ position: "sticky", top: 0, height: "100vh", zIndex: 200, flexShrink: 0 }}>
        {sidebar}
      </Box>

      <Box style={{ flex: 1, minHeight: "100vh", backgroundColor: "var(--app-bg)" }}>
        <Container size="xl" py="xl">
          <Stack gap="xl">
            <Button component={Link} href="/freelancer/dashboard" variant="subtle" leftSection={<ArrowLeft size={16} />} w="fit-content">
              Back to dashboard
            </Button>
            <Stack gap={4}>
              <Title order={2} fw={800} c="var(--app-text-strong)">Inbox</Title>
              <Text c="dimmed">Read client messages, reply to hiring requests, and follow up on project opportunities.</Text>
            </Stack>

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
                      <ThemeIcon color="cyan" variant="light" radius="md">
                        <MessageSquare size={18} />
                      </ThemeIcon>
                      <Text fw={800} c="var(--app-text)">Conversations</Text>
                    </Group>
                    <Badge color="cyan" variant="light">{conversations.length}</Badge>
                  </Group>

                  {loadingConversations ? (
                    <Center py="xl"><Loader size="sm" color="cyan" /></Center>
                  ) : conversations.length === 0 ? (
                    <Stack gap="xs" p="md">
                      <Text fw={700} c="var(--app-text)">No messages yet</Text>
                      <Text fz="sm" c="dimmed">Client outreach will appear here as soon as they message you.</Text>
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
                              href={`/freelancer/messages?with=${other.id}`}
                              withBorder={active}
                              radius="lg"
                              p="sm"
                              style={{
                                textDecoration: "none",
                                background: active ? "rgba(6,182,212,0.10)" : "transparent",
                                borderColor: active ? "rgba(6,182,212,0.35)" : "transparent",
                              }}
                            >
                              <Group wrap="nowrap" align="flex-start">
                                <Avatar size={42} radius="xl" src={other.avatar || undefined} color="indigo">
                                  <Building2 size={20} />
                                </Avatar>
                                <Stack gap={3} style={{ minWidth: 0, flex: 1 }}>
                                  <Group justify="space-between" gap="xs" wrap="nowrap">
                                    <Text fw={700} c="var(--app-text)" lineClamp={1}>{other.name}</Text>
                                    <Text fz={10} c="dimmed" style={{ flexShrink: 0 }}>{formatTime(conversation.lastMessageAt)}</Text>
                                  </Group>
                                  <Group gap="xs" wrap="nowrap">
                                    <Text fz="sm" c="dimmed" lineClamp={2} style={{ flex: 1 }}>{conversation.lastMessage || "Open conversation"}</Text>
                                    {(conversation.unreadCount || 0) > 0 && (
                                      <Badge size="xs" color="red" circle>{conversation.unreadCount}</Badge>
                                    )}
                                  </Group>
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
                        <ThemeIcon size={58} radius="xl" color="cyan" variant="light"><Mail size={28} /></ThemeIcon>
                        <Text fw={800} fz="lg" c="var(--app-text)">Select a conversation</Text>
                        <Text c="dimmed" ta="center" maw={360}>Choose a client from the left to read and reply.</Text>
                      </Stack>
                    </Center>
                  ) : (
                    <>
                      <Group justify="space-between" p="md" style={{ borderBottom: "1px solid var(--app-border)" }}>
                        <Group gap="sm">
                          <Avatar size={46} radius="xl" src={selectedClient?.avatar || undefined} color="indigo"><Building2 size={22} /></Avatar>
                          <Stack gap={1}>
                            <Text fw={800} c="var(--app-text)">{selectedName}</Text>
                            <Text fz="sm" c="dimmed">Client conversation</Text>
                          </Stack>
                        </Group>
                      </Group>

                      <ScrollArea viewportRef={viewportRef} style={{ flex: 1 }} p="md">
                        {loadingThread ? (
                          <Center py="xl"><Loader size="sm" color="cyan" /></Center>
                        ) : messages.length === 0 ? (
                          <Center py={80}>
                            <Stack align="center" gap="xs">
                              <Text fw={800} c="var(--app-text)">Start the conversation</Text>
                              <Text fz="sm" c="dimmed" ta="center">Reply to the client and ask for project details or next steps.</Text>
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
                                      background: mine ? "linear-gradient(135deg, #06b6d4, #4f46e5)" : "var(--app-bg)",
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
                            placeholder={`Message ${selectedName}...`}
                            autosize
                            minRows={1}
                            maxRows={5}
                            style={{ flex: 1 }}
                          />
                          <Button type="submit" color="cyan" loading={sending} disabled={!content.trim()} leftSection={<Send size={16} />}>
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
        </Container>
      </Box>
      </Box>
    </ProtectedRoute>
  );
}

export default function FreelancerMessagesPage() {
  return (
    <Suspense fallback={<Center py={80}><Loader color="cyan" /></Center>}>
      <FreelancerMessagesContent />
    </Suspense>
  );
}
