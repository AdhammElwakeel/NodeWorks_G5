"use client";

import { useState } from "react";
import {
  Box,
  Container,
  Grid,
  Card,
  Text,
  Title,
  Badge,
  Button,
  Group,
  Stack,
  Avatar,
  Modal,
  TextInput,
  Textarea,
  NumberInput,
  Select,
  TagsInput,
  SimpleGrid,
  ThemeIcon,
  Divider,
  ActionIcon,
  ScrollArea,
  Center,
  Progress,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  User,
  MapPin,
  DollarSign,
  Clock,
  Briefcase,
  CheckCircle2,
  Clock4,
  Star,
  TrendingUp,
  Edit3,
  FileText,
  Award,
  Globe,
  Link as LinkIcon,
  Search,
  Filter,
  Send,
  X,
  Home,
  Sun,
  Moon,
  Wallet,
  Zap,
  Bookmark,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

type Section = "home" | "jobs" | "earnings";

// ═══ MOCK DATA ═══
const MOCK_PROFILE = {
  name: "Ahmed Hassan",
  headline: "Senior Full-Stack Developer | React · Node.js · Python",
  role: "Senior",
  country: "Egypt",
  hourlyRate: 65,
  availability: "Full-time",
  about:
    "Passionate full-stack developer with 7+ years of experience building scalable web applications. Specialized in React ecosystems, Node.js microservices, and AI integration. Delivered 40+ successful projects for startups and enterprise clients across fintech, healthcare, and e-commerce sectors.\n\nI thrive in collaborative environments and love turning complex requirements into elegant, performant solutions. My approach combines clean architecture with pragmatic delivery — shipping quality code on time, every time.",
  skills: ["React", "Next.js", "TypeScript", "Node.js", "Python", "PostgreSQL", "Docker", "AWS", "GraphQL"],
  experienceLevel: "Senior",
  portfolioLinks: ["https://github.com/ahmeddev", "https://linkedin.com/in/ahmedhassan", "https://ahmedhassan.dev"],
  completedJobs: 34,
  totalEarnings: 128500,
  memberSince: "2021",
  rating: 4.9,
  reviews: 28,
};

const MOCK_JOBS = [
  {
    id: "1",
    title: "Build AI-Powered SaaS Dashboard with Next.js",
    description: "We need a senior developer to build a modern SaaS analytics dashboard using Next.js 14, Tailwind CSS, and shadcn/ui. The dashboard will display real-time metrics, charts, and user management features. Experience with Recharts or D3.js preferred.",
    budget: 8500,
    budgetType: "fixed",
    skills: ["Next.js", "TypeScript", "Tailwind CSS", "Recharts"],
    clientName: "TechFlow Inc.",
    clientAvatar: "TF",
    postedAt: "2 hours ago",
    proposals: 12,
    saved: false,
  },
  {
    id: "2",
    title: "Node.js Microservices Architecture Refactor",
    description: "Our legacy monolithic backend needs to be broken down into microservices. We're looking for someone with deep Node.js and Docker experience to design and implement a service-oriented architecture using Fastify, PostgreSQL, and RabbitMQ.",
    budget: 12000,
    budgetType: "fixed",
    skills: ["Node.js", "Docker", "PostgreSQL", "Microservices"],
    clientName: "ScaleUp Labs",
    clientAvatar: "SU",
    postedAt: "5 hours ago",
    proposals: 8,
    saved: true,
  },
  {
    id: "3",
    title: "React Native Mobile App for Fitness Startup",
    description: "Develop a cross-platform fitness tracking app with social features. The app needs workout tracking, progress charts, social feeds, and integration with health APIs (Apple HealthKit / Google Fit). Clean UI/UX is critical.",
    budget: 45,
    budgetType: "hourly",
    skills: ["React Native", "TypeScript", "Mobile Development", "UI Design"],
    clientName: "FitPulse",
    clientAvatar: "FP",
    postedAt: "1 day ago",
    proposals: 24,
    saved: false,
  },
  {
    id: "4",
    title: "E-commerce Platform Migration to Headless Shopify",
    description: "Migrate our existing WooCommerce store to a headless Shopify + Next.js setup. We need custom storefront, optimized checkout flow, and integration with our existing inventory management system.",
    budget: 6000,
    budgetType: "fixed",
    skills: ["Shopify", "Next.js", "GraphQL", "E-commerce"],
    clientName: "Meridian Goods",
    clientAvatar: "MG",
    postedAt: "1 day ago",
    proposals: 15,
    saved: false,
  },
  {
    id: "5",
    title: "Python Data Pipeline & ML Model Deployment",
    description: "Build an end-to-end data pipeline that ingests user behavior data, processes it with Pandas/Polars, trains a recommendation model with scikit-learn, and deploys the model as a FastAPI microservice.",
    budget: 55,
    budgetType: "hourly",
    skills: ["Python", "Machine Learning", "FastAPI", "PostgreSQL"],
    clientName: "DataMind AI",
    clientAvatar: "DM",
    postedAt: "2 days ago",
    proposals: 6,
    saved: true,
  },
  {
    id: "6",
    title: "Real-time Collaborative Whiteboard (WebSockets + Canvas)",
    description: "Create a real-time collaborative whiteboard similar to Excalidraw or Miro Lite. Users can draw shapes, add sticky notes, and collaborate in real-time. WebSockets for real-time sync, Canvas API for rendering.",
    budget: 9500,
    budgetType: "fixed",
    skills: ["TypeScript", "WebSockets", "Canvas API", "React"],
    clientName: "CollabSpace",
    clientAvatar: "CS",
    postedAt: "3 days ago",
    proposals: 19,
    saved: false,
  },
];

const MOCK_PROPOSALS = [
  {
    id: "p1",
    projectTitle: "Build AI-Powered SaaS Dashboard with Next.js",
    status: "pending",
    coverLetter: "I have extensive experience with Next.js 14 and have built several SaaS dashboards with real-time analytics. My recent project for FinTech Corp used Recharts with WebSocket feeds...",
    proposedRate: 8500,
    submittedAt: "2 days ago",
  },
  {
    id: "p2",
    projectTitle: "Python Data Pipeline & ML Model Deployment",
    status: "accepted",
    coverLetter: "I've built 5+ ML pipelines in production using FastAPI, Polars, and scikit-learn. My approach focuses on reproducible pipelines with proper testing and monitoring...",
    proposedRate: 55,
    submittedAt: "1 week ago",
  },
  {
    id: "p3",
    projectTitle: "Real-time Collaborative Whiteboard",
    status: "rejected",
    coverLetter: "I built a similar whiteboard tool for a YC-backed startup last year. I used Yjs for CRDT-based collaboration and Canvas API with offscreen rendering for performance...",
    proposedRate: 9000,
    submittedAt: "2 weeks ago",
  },
];

const MOCK_EARNINGS = {
  totalEarnings: 128500,
  thisMonth: 12400,
  pending: 3200,
  available: 8100,
  transactions: [
    { id: "t1", project: "SaaS Dashboard", client: "TechFlow Inc.", amount: 4250, date: "Apr 15, 2025", status: "completed" },
    { id: "t2", project: "API Integration", client: "CloudScale", amount: 1800, date: "Apr 10, 2025", status: "completed" },
    { id: "t3", project: "Mobile App UI", client: "FitPulse", amount: 3200, date: "Apr 5, 2025", status: "pending" },
    { id: "t4", project: "E-commerce Migration", client: "Meridian Goods", amount: 5600, date: "Mar 28, 2025", status: "completed" },
    { id: "t5", project: "ML Pipeline", client: "DataMind AI", amount: 2100, date: "Mar 20, 2025", status: "completed" },
    { id: "t6", project: "Whiteboard Tool", client: "CollabSpace", amount: 3800, date: "Mar 15, 2025", status: "completed" },
  ],
  monthlyStats: [
    { month: "Jan", earnings: 8200 },
    { month: "Feb", earnings: 9500 },
    { month: "Mar", earnings: 12100 },
    { month: "Apr", earnings: 12400 },
    { month: "May", earnings: 10800 },
    { month: "Jun", earnings: 13500 },
  ],
};

// ═══ COMPONENT ═══
export default function FreelancerDashboardPage() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const [activeSection, setActiveSection] = useState<Section>("home");

  // Edit modal
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [editForm, setEditForm] = useState({
    name: MOCK_PROFILE.name,
    headline: MOCK_PROFILE.headline,
    about: MOCK_PROFILE.about,
    country: MOCK_PROFILE.country,
    hourlyRate: MOCK_PROFILE.hourlyRate,
    experienceLevel: MOCK_PROFILE.experienceLevel,
    availability: MOCK_PROFILE.availability,
    skills: [...MOCK_PROFILE.skills],
    portfolioLinks: [...MOCK_PROFILE.portfolioLinks],
  });

  // Apply modal
  const [applyJob, setApplyJob] = useState<any>(null);
  const [applyOpened, { open: openApply, close: closeApply }] = useDisclosure(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [proposedRate, setProposedRate] = useState<string | number>("");

  // Jobs filters
  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState<string | null>(null);
  const [savedJobs, setSavedJobs] = useState<Set<string>>(
    new Set(MOCK_JOBS.filter((j) => j.saved).map((j) => j.id))
  );

  const profileCompletion = 85;
  const acceptedCount = MOCK_PROPOSALS.filter((p) => p.status === "accepted").length;
  const pendingCount = MOCK_PROPOSALS.filter((p) => p.status === "pending").length;

  const filteredJobs = MOCK_JOBS.filter((job) => {
    const matchSearch =
      !search ||
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.description.toLowerCase().includes(search.toLowerCase());
    const matchSkill = !skillFilter || job.skills.includes(skillFilter);
    return matchSearch && matchSkill;
  });

  const allJobSkills = Array.from(new Set(MOCK_JOBS.flatMap((j) => j.skills)));

  function handleApply(job: any) {
    setApplyJob(job);
    setCoverLetter("");
    setProposedRate(job.budgetType === "hourly" ? job.budget : job.budget);
    openApply();
  }

  function toggleSave(jobId: string) {
    setSavedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  // ─── Sidebar Nav Item ───
  function SidebarNavItem({
    icon,
    label,
    section,
    badge,
  }: {
    icon: React.ReactNode;
    label: string;
    section: Section;
    badge?: number;
  }) {
    const active = activeSection === section;
    return (
      <Button
        variant={active ? "filled" : "subtle"}
        color="dark"
        leftSection={icon}
        onClick={() => setActiveSection(section)}
        justify="flex-start"
        fullWidth
        radius="md"
        size="md"
        styles={{
          root: {
            height: 48,
            fontWeight: 600,
            transition: "all 0.15s",
          },
          inner: { justifyContent: "flex-start" },
        }}
        rightSection={
          badge ? (
            <Badge size="sm" variant="light" color={active ? "white" : "cyan"}>
              {badge}
            </Badge>
          ) : undefined
        }
      >
        {label}
      </Button>
    );
  }

  // ─── SIDEBAR ───
  const sidebar = (
    <Box
      w={280}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        height: "100vh",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        backgroundColor: isDark ? "#1e293b" : "white",
        borderRight: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
      }}
    >
      {/* Logo */}
      <Box p="lg">
        <Group gap="sm">
          <Box
            p="xs"
            style={{
              background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={20} color="white" fill="white" />
          </Box>
          <Text fw={700} fz="xl" c={isDark ? "white" : "black"}>
            NodeWorks
          </Text>
        </Group>
      </Box>

      <Divider mx="md" color={isDark ? "gray.7" : "gray.2"} />

      {/* Nav */}
      <Stack gap={6} px="md" pt="md" flex={1}>
        <SidebarNavItem
          icon={<Home size={20} />}
          label="Home"
          section="home"
          badge={pendingCount || undefined}
        />
        <SidebarNavItem
          icon={<Briefcase size={20} />}
          label="Browse Jobs"
          section="jobs"
          badge={MOCK_JOBS.length}
        />
        <SidebarNavItem
          icon={<Wallet size={20} />}
          label="Earnings"
          section="earnings"
        />
      </Stack>

      {/* Bottom: Profile + Theme */}
      <Stack gap="md" p="md">
        <Divider color={isDark ? "gray.7" : "gray.2"} />

        <Card
          withBorder
          radius="md"
          p="sm"
          style={{
            backgroundColor: isDark ? "#0f172a" : "#f8fafc",
            borderColor: isDark ? "#334155" : "#e2e8f0",
            cursor: "pointer",
          }}
          onClick={() => setActiveSection("home")}
        >
          <Group gap="sm">
            <Avatar size={40} radius="xl" color="cyan">
              <User size={20} />
            </Avatar>
            <Stack gap={2} style={{ flex: 1 }}>
              <Text fw={600} fz="sm" c={isDark ? "white" : "black"} lineClamp={1}>
                {MOCK_PROFILE.name}
              </Text>
              <Text fz="xs" c={isDark ? "gray.4" : "gray.6"} lineClamp={1}>
                {MOCK_PROFILE.headline}
              </Text>
            </Stack>
          </Group>
        </Card>

        <Button
          variant="light"
          color="gray"
          leftSection={isDark ? <Sun size={16} /> : <Moon size={16} />}
          onClick={() => setColorScheme(isDark ? "light" : "dark")}
          fullWidth
          radius="md"
          styles={{
            root: {
              backgroundColor: isDark ? "#334155" : "#f1f5f9",
              color: isDark ? "white" : "#334155",
            },
          }}
        >
          {isDark ? "Light Mode" : "Dark Mode"}
        </Button>
      </Stack>
    </Box>
  );

  // ─── HEADER BANNER ───
  const headerBanner = (
    <Box
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        padding: "48px 0 32px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        style={{
          position: "absolute",
          top: "-60px",
          right: "15%",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)",
        }}
      />
      <Box
        style={{
          position: "absolute",
          bottom: "-40px",
          left: "10%",
          width: 250,
          height: 250,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
        }}
      />

      <Container size="xl" style={{ position: "relative", zIndex: 1 }}>
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Group gap="xl" align="flex-start" wrap="wrap">
            <Box style={{ position: "relative" }}>
              <Avatar
                size={100}
                radius="xl"
                color="cyan"
                style={{
                  border: "4px solid rgba(6,182,212,0.3)",
                  boxShadow: "0 8px 32px rgba(6,182,212,0.25)",
                }}
              >
                <User size={52} strokeWidth={1.5} />
              </Avatar>
              <Box
                style={{
                  position: "absolute",
                  bottom: 4,
                  right: 4,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "#22c55e",
                  border: "3px solid #0f172a",
                }}
              />
            </Box>
            <Stack gap={6}>
              <Group gap="sm">
                <Title order={2} c="white" fw={700}>
                  {MOCK_PROFILE.name}
                </Title>
                <Badge color="cyan" variant="light" size="lg">
                  {MOCK_PROFILE.role}
                </Badge>
              </Group>
              <Text c="gray.3" fz="lg" fw={500}>
                {MOCK_PROFILE.headline}
              </Text>
              <Group gap="lg" mt={4}>
                <Group gap={4}>
                  <MapPin size={14} color="#94a3b8" />
                  <Text c="gray.4" fz="sm">
                    {MOCK_PROFILE.country}
                  </Text>
                </Group>
                <Group gap={4}>
                  <DollarSign size={14} color="#94a3b8" />
                  <Text c="gray.4" fz="sm">
                    ${MOCK_PROFILE.hourlyRate}/hr
                  </Text>
                </Group>
                <Group gap={4}>
                  <Clock size={14} color="#94a3b8" />
                  <Text c="gray.4" fz="sm">
                    {MOCK_PROFILE.availability}
                  </Text>
                </Group>
              </Group>
            </Stack>
          </Group>

          <Stack gap="sm" align="flex-end">
            <Button
              color="cyan"
              variant="light"
              leftSection={<Edit3 size={16} />}
              onClick={openEdit}
            >
              Edit Profile
            </Button>
            <Group gap="xs">
              <Badge color="green" variant="light" size="sm">
                <Group gap={4}>
                  <CheckCircle2 size={12} />
                  {acceptedCount} Hired
                </Group>
              </Badge>
              <Badge color="orange" variant="light" size="sm">
                <Group gap={4}>
                  <Clock4 size={12} />
                  {pendingCount} Pending
                </Group>
              </Badge>
            </Group>
          </Stack>
        </Group>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
          {[
            { icon: <Briefcase size={20} />, label: "Proposals", value: MOCK_PROPOSALS.length, color: "blue" },
            { icon: <CheckCircle2 size={20} />, label: "Accepted", value: acceptedCount, color: "green" },
            { icon: <Star size={20} />, label: "Profile Score", value: `${profileCompletion}%`, color: "yellow" },
            { icon: <TrendingUp size={20} />, label: "Active Jobs", value: 2, color: "cyan" },
          ].map((stat) => (
            <Card
              key={stat.label}
              bg="rgba(255,255,255,0.04)"
              style={{ border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}
              radius="md"
              p="sm"
            >
              <Group gap="sm">
                <ThemeIcon
                  color={stat.color}
                  variant="light"
                  size={36}
                  radius="md"
                  style={{ background: "rgba(255,255,255,0.06)", color: "white" }}
                >
                  {stat.icon}
                </ThemeIcon>
                <Stack gap={2}>
                  <Text fw={700} fz="xl" c="white">
                    {stat.value}
                  </Text>
                  <Text fz="xs" c="gray.4">
                    {stat.label}
                  </Text>
                </Stack>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  );

  // ─── HOME SECTION ───
  const homeSection = (
    <Stack gap="xl">
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            <Card withBorder radius="md" shadow="sm">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={600} c="black">Profile Completion</Text>
                  <Text fw={700} c="cyan.8">{profileCompletion}%</Text>
                </Group>
                <Progress value={profileCompletion} color={profileCompletion > 80 ? "green" : "cyan"} radius="xl" size="md" />
              </Stack>
            </Card>

            <Card withBorder radius="md" shadow="sm">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={600} c="black">Skills</Text>
                  <ActionIcon variant="subtle" color="cyan" onClick={openEdit}>
                    <Edit3 size={16} />
                  </ActionIcon>
                </Group>
                <Group gap="xs" wrap="wrap">
                  {MOCK_PROFILE.skills.map((skill) => (
                    <Badge key={skill} color="cyan" variant="light" size="md" radius="sm" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)" }}>
                      {skill}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </Card>

            <Card withBorder radius="md" shadow="sm">
              <Stack gap="xs">
                <Text fw={600} c="black">Hourly Rate</Text>
                <Group gap="xs">
                  <DollarSign size={18} color="var(--mantine-color-cyan-6)" />
                  <Text fw={700} fz="xl" c="black">${MOCK_PROFILE.hourlyRate}/hr</Text>
                </Group>
              </Stack>
            </Card>

            <Card withBorder radius="md" shadow="sm">
              <Stack gap="xs">
                <Text fw={600} c="black">Availability</Text>
                <Group gap="xs">
                  <Box style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
                  <Text c="black">{MOCK_PROFILE.availability}</Text>
                </Group>
              </Stack>
            </Card>

            <Card withBorder radius="md" shadow="sm">
              <Stack gap="xs">
                <Text fw={600} c="black">Member Since</Text>
                <Text c="black">{MOCK_PROFILE.memberSince}</Text>
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            <Card withBorder radius="md" shadow="sm">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon color="blue" variant="light" radius="md"><FileText size={16} /></ThemeIcon>
                    <Text fw={700} c="black" fz="lg">About</Text>
                  </Group>
                  <ActionIcon variant="subtle" color="cyan" onClick={openEdit}><Edit3 size={16} /></ActionIcon>
                </Group>
                <Text c="black" style={{ whiteSpace: "pre-line", lineHeight: 1.7 }}>
                  {MOCK_PROFILE.about}
                </Text>
              </Stack>
            </Card>

            <Card withBorder radius="md" shadow="sm">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon color="indigo" variant="light" radius="md"><Award size={16} /></ThemeIcon>
                    <Text fw={700} c="black" fz="lg">Experience</Text>
                  </Group>
                  <ActionIcon variant="subtle" color="cyan" onClick={openEdit}><Edit3 size={16} /></ActionIcon>
                </Group>
                <Badge size="lg" variant="light" color="indigo">{MOCK_PROFILE.experienceLevel} Level</Badge>
                <Text fz="sm" c="black">7+ years in full-stack development across multiple industries</Text>
              </Stack>
            </Card>

            <Card withBorder radius="md" shadow="sm">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon color="green" variant="light" radius="md"><Globe size={16} /></ThemeIcon>
                    <Text fw={700} c="black" fz="lg">Portfolio Links</Text>
                  </Group>
                  <ActionIcon variant="subtle" color="cyan" onClick={openEdit}><Edit3 size={16} /></ActionIcon>
                </Group>
                <Stack gap="xs">
                  {MOCK_PROFILE.portfolioLinks.map((link, i) => (
                    <Card key={i} withBorder radius="sm" p="xs" style={{ cursor: "pointer" }} onClick={() => window.open(link, "_blank")}>
                      <Group gap="xs">
                        <LinkIcon size={14} color="var(--mantine-color-cyan-6)" />
                        <Text c="cyan.7" fz="sm" fw={500}>{link.replace(/^https?:\/\//, "")}</Text>
                        <ChevronRight size={14} color="var(--mantine-color-gray-5)" style={{ marginLeft: "auto" }} />
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Stack>
            </Card>

            {/* Recent Proposals on Home */}
            <Card withBorder radius="md" shadow="sm">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="sm">
                    <ThemeIcon color="orange" variant="light" radius="md"><FileText size={16} /></ThemeIcon>
                    <Text fw={700} c="black" fz="lg">Recent Proposals</Text>
                  </Group>
                  <Button variant="subtle" size="xs" onClick={() => {}}>View All</Button>
                </Group>
                <Stack gap="xs">
                  {MOCK_PROPOSALS.map((proposal) => (
                    <Card key={proposal.id} withBorder radius="sm" p="xs">
                      <Group justify="space-between" align="flex-start">
                        <Stack gap={4} style={{ flex: 1 }}>
                          <Group gap="sm">
                            <Text fw={600} c="black" fz="sm">{proposal.projectTitle}</Text>
                            <Badge size="sm" variant="light" color={proposal.status === "accepted" ? "green" : proposal.status === "rejected" ? "red" : "orange"}>
                              {proposal.status}
                            </Badge>
                          </Group>
                          <Text fz="xs" c="black" lineClamp={2}>{proposal.coverLetter}</Text>
                        </Stack>
                        <Text fz="sm" fw={500} c="cyan.7">${proposal.proposedRate.toLocaleString()}</Text>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );

  // ─── JOBS SECTION ───
  const jobsSection = (
    <Stack gap="xl">
      <Card withBorder radius="md" shadow="sm">
        <Group gap="md" wrap="wrap">
          <TextInput
            placeholder="Search jobs by title or keyword..."
            leftSection={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 250 }}
            radius="md"
            size="md"
          />
          <Select
            placeholder="Filter by skill"
            data={allJobSkills}
            value={skillFilter}
            onChange={setSkillFilter}
            clearable
            leftSection={<Filter size={16} />}
            style={{ minWidth: 180 }}
            radius="md"
            size="md"
          />
          <Button color="cyan" radius="md" size="md" onClick={() => {}}>
            Search
          </Button>
        </Group>
      </Card>

      <Group justify="space-between">
        <Text fw={600} c="black">{filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""} found</Text>
        <Button variant="subtle" size="sm" color="gray" onClick={() => { setSearch(""); setSkillFilter(null); }}>
          Clear filters
        </Button>
      </Group>

      {filteredJobs.length === 0 ? (
        <Card withBorder radius="md" p="xl">
          <Center>
            <Stack align="center" gap="sm">
              <Briefcase size={48} color="#94a3b8" />
              <Text fw={600} c="black">No jobs found</Text>
              <Text fz="sm" c="black" ta="center">Try adjusting your search or check back later for new opportunities.</Text>
            </Stack>
          </Center>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {filteredJobs.map((job) => {
            const isSaved = savedJobs.has(job.id);
            return (
              <Card
                key={job.id}
                withBorder
                radius="md"
                shadow="sm"
                style={{ transition: "all 0.2s ease", position: "relative", overflow: "visible" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(0,0,0,0.1)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
              >
                <ActionIcon
                  variant="subtle"
                  color={isSaved ? "pink" : "gray"}
                  style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}
                  onClick={(e) => { e.stopPropagation(); toggleSave(job.id); }}
                >
                  <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
                </ActionIcon>

                <Stack gap="sm">
                  <Group justify="space-between" pr={30}>
                    <Badge color="green" variant="light" size="sm" radius="sm">Open</Badge>
                    {job.budget && (
                      <Group gap={4}>
                        <DollarSign size={14} color="var(--mantine-color-cyan-6)" />
                        <Text fw={700} fz="sm" c="black">{job.budgetType === "hourly" ? `$${job.budget}/hr` : `$${job.budget.toLocaleString()}`}</Text>
                      </Group>
                    )}
                  </Group>

                  <Text fw={700} c="black" lineClamp={2} fz="lg">{job.title}</Text>
                  <Text fz="sm" c="black" lineClamp={3}>{job.description}</Text>

                  <Group gap="xs" wrap="wrap">
                    {job.skills.slice(0, 4).map((s: string) => (
                      <Badge key={s} size="sm" variant="light" color="cyan" radius="sm" style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)" }}>{s}</Badge>
                    ))}
                    {job.skills.length > 4 && <Badge size="sm" variant="light" color="gray" radius="sm">+{job.skills.length - 4}</Badge>}
                  </Group>

                  <Divider />

                  <Group justify="space-between">
                    <Group gap="xs">
                      <Avatar size={28} radius="xl" color="indigo" fz="xs">{job.clientAvatar}</Avatar>
                      <Stack gap={0}>
                        <Text fz="sm" fw={500} c="black">{job.clientName}</Text>
                        <Text fz="xs" c="black">{job.postedAt} · {job.proposals} proposals</Text>
                      </Stack>
                    </Group>
                  </Group>

                  <Button fullWidth color="cyan" radius="md" leftSection={<Send size={16} />} onClick={() => handleApply(job)}>
                    Apply Now
                  </Button>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      )}
    </Stack>
  );

  // ─── EARNINGS SECTION ───
  const earningsSection = (
    <Stack gap="xl">
      {/* Stats Row */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        {[
          { label: "Total Earnings", value: `$${MOCK_EARNINGS.totalEarnings.toLocaleString()}`, icon: <Wallet size={20} />, color: "cyan", change: "+12%" },
          { label: "This Month", value: `$${MOCK_EARNINGS.thisMonth.toLocaleString()}`, icon: <TrendingUp size={20} />, color: "green", change: "+8%" },
          { label: "Pending", value: `$${MOCK_EARNINGS.pending.toLocaleString()}`, icon: <Clock4 size={20} />, color: "orange", change: "2 jobs" },
          { label: "Available", value: `$${MOCK_EARNINGS.available.toLocaleString()}`, icon: <DollarSign size={20} />, color: "blue", change: "Ready" },
        ].map((stat) => (
          <Card key={stat.label} withBorder radius="md" shadow="sm">
            <Stack gap="sm">
              <Group justify="space-between">
                <ThemeIcon color={stat.color} variant="light" size={40} radius="md">{stat.icon}</ThemeIcon>
                <Badge size="sm" variant="light" color={stat.color} leftSection={<ArrowUpRight size={12} />}>
                  {stat.change}
                </Badge>
              </Group>
              <Text fw={700} fz="xl" c="black">{stat.value}</Text>
              <Text fz="sm" c="black">{stat.label}</Text>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      {/* Monthly Overview */}
      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={700} c="black" fz="lg">Earnings Overview</Text>
            <Button variant="subtle" size="sm" color="gray">View Report</Button>
          </Group>
          <SimpleGrid cols={{ base: 3, sm: 6 }} spacing="md">
            {MOCK_EARNINGS.monthlyStats.map((m) => (
              <Card key={m.month} withBorder radius="md" p="sm" style={{ textAlign: "center" }}>
                <Text fw={700} fz="lg" c="black">${(m.earnings / 1000).toFixed(1)}k</Text>
                <Text fz="xs" c="black" mt={4}>{m.month}</Text>
                <Box mt={8} style={{ height: 4, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                  <Box style={{ width: `${(m.earnings / 15000) * 100}%`, height: "100%", background: "linear-gradient(90deg, #06b6d4, #4f46e5)", borderRadius: 2 }} />
                </Box>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      </Card>

      {/* Transactions */}
      <Card withBorder radius="md" shadow="sm">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={700} c="black" fz="lg">Recent Transactions</Text>
            <Button variant="subtle" size="sm" color="gray">View All</Button>
          </Group>
          <Stack gap="xs">
            {MOCK_EARNINGS.transactions.map((tx) => (
              <Card key={tx.id} withBorder radius="sm" p="sm">
                <Group justify="space-between" align="flex-start">
                  <Group gap="sm" align="flex-start">
                    <ThemeIcon
                      color={tx.status === "completed" ? "green" : "orange"}
                      variant="light"
                      size={40}
                      radius="md"
                    >
                      {tx.status === "completed" ? <CheckCircle2 size={20} /> : <Clock4 size={20} />}
                    </ThemeIcon>
                    <Stack gap={2}>
                      <Text fw={600} c="black" fz="sm">{tx.project}</Text>
                      <Text fz="xs" c="black">{tx.client} · {tx.date}</Text>
                    </Stack>
                  </Group>
                  <Stack gap={2} align="flex-end">
                    <Text fw={700} c="black" fz="md">${tx.amount.toLocaleString()}</Text>
                    <Badge size="sm" variant="light" color={tx.status === "completed" ? "green" : "orange"}>
                      {tx.status}
                    </Badge>
                  </Stack>
                </Group>
              </Card>
            ))}
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );

  return (
    <Box style={{ display: "flex", minHeight: "100vh" }}>
      {sidebar}

      {/* Main Content */}
      <Box style={{ flex: 1, marginLeft: 280, backgroundColor: isDark ? "#0f172a" : "#f8fafc", minHeight: "100vh" }}>
        {headerBanner}

        <Container size="xl" py="xl">
          {activeSection === "home" && homeSection}
          {activeSection === "jobs" && jobsSection}
          {activeSection === "earnings" && earningsSection}
        </Container>
      </Box>

      {/* ═══ EDIT PROFILE MODAL ═══ */}
      <Modal opened={editOpened} onClose={closeEdit} title={<Text c="black" fw={700}>Edit Your Profile</Text>} size="xl" scrollAreaComponent={ScrollArea.Autosize} radius="md">
        <Stack gap="md">
          <TextInput label="Full Name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} radius="md" styles={{ label: { color: "black" } }} />
          <TextInput label="Professional Headline" value={editForm.headline} onChange={(e) => setEditForm((f) => ({ ...f, headline: e.target.value }))} radius="md" styles={{ label: { color: "black" } }} />
          <Textarea label="About You" minRows={5} value={editForm.about} onChange={(e) => setEditForm((f) => ({ ...f, about: e.target.value }))} radius="md" styles={{ label: { color: "black" } }} />
          <Group grow>
            <Select label="Experience Level" data={["Junior", "Mid-level", "Senior", "Lead"]} value={editForm.experienceLevel} onChange={(v) => setEditForm((f) => ({ ...f, experienceLevel: v || "" }))} radius="md" styles={{ label: { color: "black" } }} />
            <TextInput label="Country" value={editForm.country} onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))} radius="md" styles={{ label: { color: "black" } }} />
          </Group>
          <Group grow>
            <NumberInput label="Hourly Rate ($)" value={editForm.hourlyRate} onChange={(v) => setEditForm((f) => ({ ...f, hourlyRate: typeof v === "number" ? v : 0 }))} radius="md" styles={{ label: { color: "black" } }} />
            <Select label="Availability" data={["Full-time", "Part-time", "As needed", "Not available"]} value={editForm.availability} onChange={(v) => setEditForm((f) => ({ ...f, availability: v || "" }))} radius="md" styles={{ label: { color: "black" } }} />
          </Group>
          <TagsInput label="Skills" placeholder="Add skills and press Enter" data={["React", "Next.js", "Node.js", "TypeScript", "Python", "UI Design", "Project Management", "Data Analysis", "Content Writing", "Mobile Development"]} value={editForm.skills} onChange={(v) => setEditForm((f) => ({ ...f, skills: v }))} radius="md" styles={{ label: { color: "black" } }} />
          <TagsInput label="Portfolio Links" placeholder="Add URLs and press Enter" value={editForm.portfolioLinks} onChange={(v) => setEditForm((f) => ({ ...f, portfolioLinks: v }))} radius="md" styles={{ label: { color: "black" } }} />
          <Group justify="flex-end" mt="md">
            <Button variant="default" radius="md" onClick={closeEdit}>Cancel</Button>
            <Button color="cyan" radius="md" onClick={closeEdit}>Save Changes</Button>
          </Group>
        </Stack>
      </Modal>

      {/* ═══ APPLY MODAL ═══ */}
      <Modal opened={applyOpened} onClose={closeApply} title={`Apply: ${applyJob?.title || ""}`} size="lg" scrollAreaComponent={ScrollArea.Autosize} radius="md">
        <Stack gap="md">
          {applyJob && (
            <Card withBorder radius="md" bg="gray.0">
              <Stack gap={4}>
                <Text fw={600} c="black">{applyJob.title}</Text>
                <Text fz="sm" c="black" lineClamp={3}>{applyJob.description}</Text>
                {applyJob.budget && (
                  <Group gap={4}>
                    <DollarSign size={14} color="var(--mantine-color-cyan-6)" />
                    <Text fz="sm" fw={500} c="cyan.7">Budget: {applyJob.budgetType === "hourly" ? `$${applyJob.budget}/hr` : `$${applyJob.budget.toLocaleString()}`}</Text>
                  </Group>
                )}
              </Stack>
            </Card>
          )}
          <Textarea label="Cover Letter" placeholder="Introduce yourself, explain why you're a great fit for this project, and highlight relevant experience..." minRows={6} required value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} radius="md" />
          <NumberInput label="Your Proposed Rate ($)" placeholder="Leave blank to match project budget" value={proposedRate} onChange={setProposedRate} radius="md" />
          <Group justify="flex-end" mt="md">
            <Button variant="default" radius="md" onClick={closeApply}>Cancel</Button>
            <Button color="cyan" radius="md" onClick={() => { closeApply(); setCoverLetter(""); }} disabled={!coverLetter.trim()}>Submit Proposal</Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
