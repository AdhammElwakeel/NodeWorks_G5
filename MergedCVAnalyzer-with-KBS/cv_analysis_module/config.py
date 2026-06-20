import os
from dotenv import load_dotenv
from datetime import date
# Load .env variables
load_dotenv()

API_KEY = os.getenv("OPENCODE_GO_API_KEY")  # kept for any legacy use

# OpenCode Go credentials (used by opencode_go_client.py)
OPENCODE_GO_API_KEY  = os.getenv("OPENCODE_GO_API_KEY")
OPENCODE_GO_BASE_URL = os.getenv("OPENCODE_GO_BASE_URL")  # e.g. https://api.opencode.ai/v1

# ------------------------------------------------------------------
# 🤖 MODEL CONFIGURATION
# ------------------------------------------------------------------
MODEL_NAME = "opencode-go/glm-5.2"   # prefix stripped by _model_id() in the client
# MODEL_NAME = "glm-5.2"             # also works — prefix is optional

# ------------------------------------------------------------------
# 🎯 ROLE DEFINITIONS (The Source of Truth)
# ------------------------------------------------------------------
TECH_ROLES = {

    # ══════════════════════════════════════════════════════════════
    # FRONTEND ENGINEERING
    # ══════════════════════════════════════════════════════════════

    # Framework-specific
    "React Frontend Developer":   ["React", "JavaScript", "TypeScript", "HTML", "CSS", "Redux", "Tailwind", "REST API"],
    "Vue Frontend Developer":     ["Vue", "JavaScript", "TypeScript", "HTML", "CSS", "Vuex", "Pinia", "Tailwind"],
    "Angular Frontend Developer": ["Angular", "TypeScript", "RxJS", "HTML", "CSS", "Jasmine", "Karma"],
    "Next.js Developer":          ["Next.js", "React", "JavaScript", "TypeScript", "HTML", "CSS", "REST API", "Tailwind"],
    "Svelte Developer":           ["Svelte", "JavaScript", "TypeScript", "HTML", "CSS", "SvelteKit", "Vite"],

    # Framework-agnostic / general
    "Frontend Developer":         ["JavaScript", "TypeScript", "HTML", "CSS", "REST API", "Git", "Responsive Design", "Web Performance"],

    # ══════════════════════════════════════════════════════════════
    # BACKEND ENGINEERING
    # ══════════════════════════════════════════════════════════════

    "Django Backend Engineer":        ["Python", "Django", "SQL", "PostgreSQL", "REST API", "Docker", "Redis", "Celery"],
    "FastAPI Backend Engineer":       ["Python", "FastAPI", "SQL", "PostgreSQL", "REST API", "Docker", "Pydantic"],
    "Node.js Backend Engineer":       ["Node.js", "JavaScript", "Express", "MongoDB", "SQL", "REST API", "Docker"],
    "Spring Boot Backend Engineer":   ["Java", "Spring Boot", "Hibernate", "SQL", "PostgreSQL", "REST API", "Maven", "Docker"],
    "Go Backend Engineer":            ["Go", "gRPC", "SQL", "PostgreSQL", "Docker", "Kubernetes", "Microservices", "REST API"],
    "Ruby on Rails Backend Engineer": ["Ruby", "Rails", "SQL", "PostgreSQL", "REST API", "Docker", "Redis", "RSpec"],
    "Laravel PHP Backend Engineer":   ["PHP", "Laravel", "SQL", "MySQL", "REST API", "Docker", "Redis", "Blade"],
    ".NET Backend Engineer":          ["C#", ".NET", "ASP.NET", "SQL", "SQL Server", "REST API", "Docker", "Azure"],
    "GraphQL API Developer":          ["GraphQL", "Apollo", "Node.js", "REST API", "SQL", "MongoDB", "Docker", "TypeScript"],

    # ══════════════════════════════════════════════════════════════
    # FULL-STACK ECOSYSTEMS
    # ══════════════════════════════════════════════════════════════

    "MERN Stack Developer":         ["MongoDB", "Express", "React", "Node.js", "JavaScript", "REST API", "HTML", "CSS"],
    "Python Full-Stack Developer":  ["Python", "Django", "React", "PostgreSQL", "JavaScript", "HTML", "CSS", "Docker"],
    "Java Full-Stack Developer":    ["Java", "Spring Boot", "React", "SQL", "PostgreSQL", "JavaScript", "HTML", "CSS", "Docker"],
    "Next.js Full-Stack Developer": ["Next.js", "React", "Node.js", "TypeScript", "SQL", "MongoDB", "REST API", "Docker"],
    "PHP Full-Stack Developer":     ["PHP", "Laravel", "JavaScript", "React", "MySQL", "HTML", "CSS", "Docker"],

    # ══════════════════════════════════════════════════════════════
    # MACHINE LEARNING & DEEP LEARNING
    # ══════════════════════════════════════════════════════════════

    "Machine Learning Engineer":  ["Python", "Machine Learning", "Scikit-learn", "PyTorch", "TensorFlow", "NumPy", "Pandas", "SQL", "Docker", "Git"],
    "Deep Learning Engineer":     ["Python", "Deep Learning", "PyTorch", "TensorFlow", "Neural Networks", "GPU Computing", "CUDA", "NumPy", "Docker"],
    "Reinforcement Learning Engineer": ["Python", "Reinforcement Learning", "PyTorch", "OpenAI Gym", "Deep Learning", "Algorithm Design", "NumPy", "Simulation"],

    # ══════════════════════════════════════════════════════════════
    # DATA SCIENCE & ANALYTICS
    # ══════════════════════════════════════════════════════════════

    "Data Scientist":            ["Python", "Pandas", "NumPy", "SQL", "Statistics", "Scikit-learn", "Jupyter", "Data Visualization"],
    "Analytics Engineer":        ["SQL", "dbt", "Python", "Data Warehousing", "ETL", "Looker", "Tableau", "BigQuery"],
    "Business Intelligence Developer": ["SQL", "Power BI", "Tableau", "Data Warehousing", "ETL", "DAX", "Excel", "Data Visualization"],
    "Database Administrator":    ["SQL", "PostgreSQL", "MySQL", "Oracle", "Database Design", "Query Optimization", "Backup & Recovery", "Replication"],

    # ══════════════════════════════════════════════════════════════
    # DATA ENGINEERING
    # ══════════════════════════════════════════════════════════════

    "Data Engineer":             ["Python", "SQL", "Apache Spark", "Airflow", "Hadoop", "Kafka", "AWS", "Data Warehousing"],
    "Streaming Data Engineer":   ["Apache Kafka", "Apache Flink", "Python", "Spark Streaming", "AWS Kinesis", "Real-Time Processing", "SQL", "Docker"],

    # ══════════════════════════════════════════════════════════════
    # COMPUTER VISION
    # ══════════════════════════════════════════════════════════════

    "Computer Vision Engineer":  ["Python", "OpenCV", "PyTorch", "TensorFlow", "Deep Learning", "Object Detection", "YOLO", "Image Processing"],

    # ══════════════════════════════════════════════════════════════
    # NATURAL LANGUAGE PROCESSING
    # ══════════════════════════════════════════════════════════════

    "NLP Engineer":              ["Python", "NLP", "Hugging Face", "Transformers", "NLTK", "spaCy", "PyTorch", "Deep Learning"],

    # ══════════════════════════════════════════════════════════════
    # MLOps & PLATFORM
    # ══════════════════════════════════════════════════════════════

    "MLOps Engineer":            ["Python", "MLOps", "Docker", "Kubernetes", "MLflow", "CI/CD", "AWS", "GitHub Actions"],
    "ML Platform Engineer":      ["Python", "Kubernetes", "Kubeflow", "MLflow", "Docker", "CI/CD", "Feature Stores", "Model Registry"],

    # ══════════════════════════════════════════════════════════════
    # GENERATIVE AI & LLM
    # ══════════════════════════════════════════════════════════════

    "Generative AI Engineer (Text/LLM)":    ["Python", "LLM", "Prompt Engineering", "Fine-tuning", "LoRA", "RAG", "Vector Databases", "LangChain", "PyTorch"],
    "Generative AI Engineer (Vision)":      ["Python", "Stable Diffusion", "Diffusion Models", "ControlNet", "ComfyUI", "PyTorch", "Generative Adversarial Networks (GANs)", "Computer Vision"],
    "Generative AI Engineer (Audio/Speech)":["Python", "Text-to-Speech (TTS)", "Speech-to-Text (STT)", "Whisper", "Audio Processing", "PyTorch", "Deep Learning"],

    # ══════════════════════════════════════════════════════════════
    # AGENTIC AI
    # ══════════════════════════════════════════════════════════════

    "AI Agent Engineer":            ["Python", "LangChain", "LangGraph", "AutoGen", "Tool Calling", "RAG", "LLM", "API Integration"],
    "Multi-Agent Systems Engineer": ["Python", "CrewAI", "AutoGen", "Multi-Agent Collaboration", "System Design", "LLM", "Semantic Routing"],

    # ══════════════════════════════════════════════════════════════
    # RESEARCH ROLES
    # ══════════════════════════════════════════════════════════════

    "AI/ML Researcher":                    ["Machine Learning", "Deep Learning", "PyTorch", "Publications", "Research", "Mathematics", "Statistics", "Algorithm Design"],
    "Machine Learning Researcher":         ["Machine Learning", "Deep Learning", "PyTorch", "TensorFlow", "Publications", "Research", "Mathematics", "Statistics"],
    "Deep Learning Researcher":            ["Deep Learning", "Neural Networks", "PyTorch", "Mathematics", "Publications", "Research", "GPU Computing", "Algorithm Design"],
    "Reinforcement Learning Researcher":   ["Reinforcement Learning", "PyTorch", "Deep Learning", "Algorithm Design", "Mathematics", "Publications", "Research", "OpenAI Gym"],
    "Computer Vision Researcher":          ["Computer Vision", "PyTorch", "Image Processing", "Object Detection", "Publications", "Research", "Mathematical Modeling"],
    "NLP Researcher":                      ["NLP", "Transformers", "Large Language Models", "PyTorch", "Linguistics", "Publications", "Research", "Text Analysis"],
    "Data Science Researcher":             ["Statistics", "Machine Learning", "Python", "R", "Publications", "Research", "Experimental Design", "Data Analysis"],
    "Robotics Researcher":                 ["Robotics", "ROS", "Python", "C++", "Kinematics", "SLAM", "Publications", "Research"],
    "Human-Computer Interaction Researcher":["User Research", "Usability Testing", "Prototyping", "Python", "Statistics", "Publications", "Research", "Cognitive Science"],

    # ══════════════════════════════════════════════════════════════
    # MOBILE ENGINEERING
    # ══════════════════════════════════════════════════════════════

    "iOS Developer":            ["Swift", "iOS", "Xcode", "UIKit", "SwiftUI", "Core Data"],
    "Android Developer":        ["Kotlin", "Android", "Android Studio", "Java", "Jetpack Compose", "Room"],
    "React Native Developer":   ["React Native", "JavaScript", "TypeScript", "React", "iOS", "Android"],
    "Flutter Developer":        ["Flutter", "Dart", "iOS", "Android", "Firebase"],

    # ══════════════════════════════════════════════════════════════
    # CLOUD & INFRASTRUCTURE
    # ══════════════════════════════════════════════════════════════

    "Cloud Architect (AWS)":    ["AWS", "EC2", "S3", "IAM", "Terraform", "Docker", "Linux", "Serverless"],
    "Cloud Architect (GCP)":    ["GCP", "Google Cloud", "BigQuery", "Cloud Functions", "Kubernetes", "Terraform", "Docker", "Linux"],
    "Cloud Architect (Azure)":  ["Azure", "Azure DevOps", "ARM Templates", "Terraform", "Docker", "Kubernetes", "Linux", "CI/CD"],
    "DevOps Engineer":          ["Docker", "Kubernetes", "CI/CD", "Linux", "Terraform", "Jenkins", "Ansible", "Bash"],
    "Site Reliability Engineer":["Linux", "Kubernetes", "Docker", "Monitoring", "Observability", "Python", "Go", "Incident Management"],

    # ══════════════════════════════════════════════════════════════
    # CYBERSECURITY
    # ══════════════════════════════════════════════════════════════

    "Cybersecurity Engineer":   ["Security", "Penetration Testing", "Cryptography", "Linux", "Networking", "Bash", "Wireshark"],
    "Penetration Tester":       ["Penetration Testing", "Kali Linux", "Metasploit", "Burp Suite", "Networking", "Python", "OWASP", "Bash"],
    "Security Analyst":         ["Security", "SIEM", "Incident Response", "Threat Intelligence", "Networking", "Wireshark", "Linux", "Forensics"],
    "Application Security Engineer": ["Security", "OWASP", "Penetration Testing", "Secure Code Review", "Python", "Burp Suite", "Docker", "CI/CD"],

    # ══════════════════════════════════════════════════════════════
    # BLOCKCHAIN & WEB3
    # ══════════════════════════════════════════════════════════════

    "Blockchain Developer":         ["Solidity", "Ethereum", "Web3.js", "Smart Contracts", "JavaScript", "Hardhat", "IPFS", "Cryptography"],
    "Smart Contract Developer":     ["Solidity", "Ethereum", "Hardhat", "Foundry", "Smart Contracts", "OpenZeppelin", "Web3.js", "Security"],
    "Web3 Frontend Developer":      ["React", "JavaScript", "TypeScript", "Web3.js", "Ethers.js", "MetaMask", "Solidity", "HTML", "CSS"],

    # ══════════════════════════════════════════════════════════════
    # GAME DEVELOPMENT
    # ══════════════════════════════════════════════════════════════

    "Unity Game Developer":   ["Unity", "C#", "Game Development", "3D Graphics", "Physics Engine", "Shader Programming", "Animation", "Git"],
    "Unreal Engine Developer":["Unreal Engine", "C++", "Blueprints", "Game Development", "3D Graphics", "Physics Engine", "Animation", "Git"],
    "Game AI Developer":      ["Python", "C++", "Game Development", "Pathfinding", "Behavior Trees", "Reinforcement Learning", "Unity", "Algorithm Design"],

    # ══════════════════════════════════════════════════════════════
    # EMBEDDED SYSTEMS & IoT
    # ══════════════════════════════════════════════════════════════

    "Embedded Systems Engineer": ["C", "C++", "Embedded Systems", "Microcontrollers", "RTOS", "UART", "SPI", "I2C"],
    "IoT Engineer":              ["C", "C++", "Python", "IoT", "MQTT", "Raspberry Pi", "Arduino", "Embedded Systems", "Cloud IoT"],
    "Firmware Engineer":         ["C", "C++", "Firmware", "Embedded Systems", "Microcontrollers", "RTOS", "Hardware Debugging", "Bootloaders"],

    # ══════════════════════════════════════════════════════════════
    # ROBOTICS
    # ══════════════════════════════════════════════════════════════

    "Robotics Engineer":         ["ROS", "Python", "C++", "Robotics", "Kinematics", "SLAM", "Sensor Fusion", "Control Systems"],
    "Autonomous Systems Engineer":["Python", "C++", "ROS", "SLAM", "Computer Vision", "Deep Learning", "Sensor Fusion", "Path Planning"],

    # ══════════════════════════════════════════════════════════════
    # QA & TESTING
    # ══════════════════════════════════════════════════════════════

    "QA Engineer":               ["Testing", "Selenium", "Test Automation", "Python", "Java", "CI/CD", "JIRA", "REST API Testing"],
    "SDET (Software Dev in Test)":["Python", "Java", "Selenium", "Cypress", "Test Automation", "CI/CD", "Docker", "REST API Testing"],
    "Performance Test Engineer": ["JMeter", "Gatling", "k6", "Python", "Load Testing", "Performance Profiling", "CI/CD", "Linux"],

    # ══════════════════════════════════════════════════════════════
    # DESIGN & CREATIVE
    # ══════════════════════════════════════════════════════════════

    "UI/UX Designer":   ["Figma", "Adobe XD", "Wireframing", "Prototyping", "User Research", "UI Design", "UX Design"],
    "Product Designer": ["Figma", "Adobe XD", "Prototyping", "User Research", "Design Systems", "Usability Testing", "UI Design", "UX Design"],
    "Graphic Designer": ["Adobe Illustrator", "Adobe Photoshop", "Typography", "Brand Identity", "Visual Design", "Figma", "InDesign", "Color Theory"],
    "Motion Designer":  ["After Effects", "Cinema 4D", "Motion Graphics", "Adobe Illustrator", "Video Editing", "Animation", "Premiere Pro", "Figma"],

    # ══════════════════════════════════════════════════════════════
    # PRODUCT & PROJECT MANAGEMENT
    # ══════════════════════════════════════════════════════════════

    "Product Manager":             ["Product Management", "Roadmapping", "User Research", "Agile", "JIRA", "Stakeholder Management", "Data Analysis", "A/B Testing"],
    "Technical Project Manager":   ["Project Management", "Agile", "Scrum", "JIRA", "Risk Management", "Technical Background", "Stakeholder Management", "Roadmapping"],
    "Scrum Master":                ["Scrum", "Agile", "JIRA", "Confluence", "Sprint Planning", "Retrospectives", "Kanban", "Stakeholder Management"],
}


# ------------------------------------------------------------------
# 🗂️  ROLE GROUPS
# ------------------------------------------------------------------
# Each group clusters roles that are close enough that a client
# asking for one should consider candidates who score well in any
# member of the group.
#
# How it's used in the recommender:
#   When scoring a freelancer for a requested role, the system
#   looks up which group that role belongs to, then picks the
#   highest score the freelancer has across ALL roles in that group.
#   This means a "Machine Learning Engineer" request will surface
#   someone whose best score is "Computer Vision Engineer" or
#   "NLP Engineer" — not just the exact label.
#
# Rules for membership:
#   • Roles in the same group share a meaningful skill core.
#   • Roles from completely different domains stay in separate groups.
#   • Every role in TECH_ROLES must appear in exactly one group.
# ------------------------------------------------------------------

ROLE_GROUPS: dict[str, list[str]] = {

    # ── Frontend ───────────────────────────────────────────────────
    # Shared core: JavaScript/TypeScript, HTML/CSS, component-based UI.
    "FRONTEND": [
        "React Frontend Developer",
        "Vue Frontend Developer",
        "Angular Frontend Developer",
        "Next.js Developer",
        "Svelte Developer",
        "Frontend Developer",
    ],

    # ── Backend ────────────────────────────────────────────────────
    # Shared core: server-side logic, SQL/NoSQL, REST/gRPC, Docker.
    "BACKEND": [
        "Django Backend Engineer",
        "FastAPI Backend Engineer",
        "Node.js Backend Engineer",
        "Spring Boot Backend Engineer",
        "Go Backend Engineer",
        "Ruby on Rails Backend Engineer",
        "Laravel PHP Backend Engineer",
        ".NET Backend Engineer",
        "GraphQL API Developer",
    ],

    # ── Full-Stack ─────────────────────────────────────────────────
    "FULLSTACK": [
        "MERN Stack Developer",
        "Python Full-Stack Developer",
        "Java Full-Stack Developer",
        "Next.js Full-Stack Developer",
        "PHP Full-Stack Developer",
    ],

    # ── Machine Learning & Deep Learning (applied engineering) ─────
    # Shared core: Python, ML/DL frameworks, model training & deployment.
    # A client asking for "ML Engineer" or "AI Engineer" lands here.
    "ML_AND_DL": [
        "Machine Learning Engineer",
        "Deep Learning Engineer",
        "Reinforcement Learning Engineer",
        "MLOps Engineer",
        "ML Platform Engineer",
    ],

    # ── Data Science & Analytics ───────────────────────────────────
    # Shared core: SQL, statistics, visualisation, business insight.
    "DATA_SCIENCE": [
        "Data Scientist",
        "Analytics Engineer",
        "Business Intelligence Developer",
        "Database Administrator",
    ],

    # ── Data Engineering ───────────────────────────────────────────
    "DATA_ENGINEERING": [
        "Data Engineer",
        "Streaming Data Engineer",
    ],

    # ── Computer Vision ────────────────────────────────────────────
    "COMPUTER_VISION": [
        "Computer Vision Engineer",
    ],

    # ── NLP ────────────────────────────────────────────────────────
    "NLP": [
        "NLP Engineer",
    ],

    # ── Generative AI & LLMs ──────────────────────────────────────
    # Shared core: LLM APIs, prompting, fine-tuning, RAG, PyTorch.
    "GENERATIVE_AI": [
        "Generative AI Engineer (Text/LLM)",
        "Generative AI Engineer (Vision)",
        "Generative AI Engineer (Audio/Speech)",
        "AI Agent Engineer",
        "Multi-Agent Systems Engineer",
    ],

    # ── AI / ML Research ──────────────────────────────────────────
    # Shared core: publications, mathematics, deep theory.
    # Keeps research roles separate from applied engineering so a
    # researcher-heavy CV isn't over-penalised for lacking Docker/MLflow,
    # and a devops-heavy CV isn't surfaced for academic research posts.
    "AI_RESEARCH": [
        "AI/ML Researcher",
        "Machine Learning Researcher",
        "Deep Learning Researcher",
        "Reinforcement Learning Researcher",
        "Computer Vision Researcher",
        "NLP Researcher",
        "Data Science Researcher",
        "Robotics Researcher",
        "Human-Computer Interaction Researcher",
    ],

    # ── Mobile ─────────────────────────────────────────────────────
    "MOBILE": [
        "iOS Developer",
        "Android Developer",
        "React Native Developer",
        "Flutter Developer",
    ],

    # ── Cloud & Infrastructure ─────────────────────────────────────
    "CLOUD_AND_INFRA": [
        "Cloud Architect (AWS)",
        "Cloud Architect (GCP)",
        "Cloud Architect (Azure)",
        "DevOps Engineer",
        "Site Reliability Engineer",
    ],

    # ── Cybersecurity ──────────────────────────────────────────────
    "CYBERSECURITY": [
        "Cybersecurity Engineer",
        "Penetration Tester",
        "Security Analyst",
        "Application Security Engineer",
    ],

    # ── Blockchain & Web3 ──────────────────────────────────────────
    "BLOCKCHAIN": [
        "Blockchain Developer",
        "Smart Contract Developer",
        "Web3 Frontend Developer",
    ],

    # ── Game Development ───────────────────────────────────────────
    "GAME_DEV": [
        "Unity Game Developer",
        "Unreal Engine Developer",
        "Game AI Developer",
    ],

    # ── Embedded Systems & IoT ─────────────────────────────────────
    "EMBEDDED_AND_IOT": [
        "Embedded Systems Engineer",
        "IoT Engineer",
        "Firmware Engineer",
    ],

    # ── Robotics ───────────────────────────────────────────────────
    "ROBOTICS": [
        "Robotics Engineer",
        "Autonomous Systems Engineer",
    ],

    # ── QA & Testing ───────────────────────────────────────────────
    "QA_AND_TESTING": [
        "QA Engineer",
        "SDET (Software Dev in Test)",
        "Performance Test Engineer",
    ],

    # ── Design & Creative ──────────────────────────────────────────
    "DESIGN": [
        "UI/UX Designer",
        "Product Designer",
        "Graphic Designer",
        "Motion Designer",
    ],

    # ── Product & Project Management ───────────────────────────────
    "MANAGEMENT": [
        "Product Manager",
        "Technical Project Manager",
        "Scrum Master",
    ],
}

# Reverse lookup: role_name → group_name  (auto-built, do not edit)
ROLE_TO_GROUP: dict[str, str] = {
    role: group
    for group, roles in ROLE_GROUPS.items()
    for role in roles
}

# ------------------------------------------------------------------
# 🧠 DYNAMIC SYSTEM PROMPT
# ------------------------------------------------------------------
roles_str = ""
for role, skills in TECH_ROLES.items():
    roles_str += f"- {role} requires: {', '.join(skills)}\n"

CV_PARSER_PROMPT = f"""
You are an expert Technical Recruiter AI.
Your job is to extract structured data from a resume and return ONLY valid JSON.

### PART 1 — SKILL EXTRACTION

Extract and normalize all TECHNICAL skills to match our Standard Technology List.

**Our Standard Roles & Skills:**
{roles_str}

**Skill Mapping Rules:**
1. **Synonyms:** "React.js" → "React", "Large Language Models" → "LLM", "Postgres" → "PostgreSQL".
2. **Implication:** "Vision Transformers" or "BERT" → add "Transformers" AND "Deep Learning". "AWS EC2" → add "AWS". "Android Studio" → add "Android".
3. **Context:** If a project used "YOLO" → add "Object Detection", "Deep Learning", "OpenCV". If used "Pandas" → add "Data Visualization", "NumPy" if implied.
4. **Research Inference (CRITICAL):** If the candidate lists ANY published papers, conference papers, or journal articles → MUST add "Publications" and "Research" to all_skills. A Master's/PhD thesis → add "Research".
5. **Agentic/GenAI Inference:** Mentions of CrewAI/AutoGen/LangGraph/AI Agents → add "Tool Calling" and "Multi-Agent Collaboration".
6. **Completeness:** Extract ALL skills mentioned anywhere — skills section, projects, experience, certifications, and education. Do NOT skip skills found only in projects or certifications.
7. **Inference:** If they mention "Prompt Engineering" or "Fine-tuning" → add "LLM". If they mention "Stable Diffusion" → add "Generative AI (Vision)". If they mention "Whisper" → add "Generative AI (Audio/Speech)". If they mention "Deep Learning" → add "Machine learning".

---

### PART 2 — DOMAIN KNOWLEDGE EXTRACTION

**Domain knowledge is DIFFERENT from technical skills.**
- Technical skills = tools, languages, frameworks (e.g. "PyTorch", "React", "Docker") → goes in `all_skills`
- Domain knowledge = subject areas, industries, problem spaces the candidate has worked in → goes in `domain_knowledge`

**Extract domain knowledge from EVERY section of the CV:**
- Publications & Research: What field/topic is the research about?
- Projects: What real-world problem or industry does the project address?
- Work Experience: What industry or domain did they work in?
- Internships: What domain did the internship involve?
- Certifications & Courses: What subject area do they cover?
- Education specializations and focus areas.

**Domain Knowledge Examples (use concise 2-4 word phrases, Title Case):**
  Medical Imaging, Satellite IoT, Drug Safety, Stock Market Prediction,
  Diabetic Retinopathy, Solar Physics, Gravitational Wave Detection,
  Bone Fracture Detection, Pneumonia Detection, Lung Nodule Segmentation,
  Space Weather, Meteor Classification, Radio Burst Detection, Astronomy,
  Anomaly Detection, Deepfake Detection, Cybersecurity, Astrophysics,
  Natural Language Processing Research, Recommendation Systems,
  Healthcare Technology, Banking Systems, E-commerce, Education Technology,
  Freelance Platforms, Knowledge Graphs, Team Formation, Smart Pharmacy,
  Robotic Systems, Voice Control, Planetary Simulation, Fake News Detection,
  Book Recommendation, Movie Recommendation, Restaurant Management,
  Financial Technology, Manufacturing, Supply Chain, Clinical Systems,
  Ionospheric Forecasting, Sunspot Detection, Stellar Evolution

**Rules for domain_knowledge:**
- Extract the TOPIC/DOMAIN, not the method. "Used CNNs to detect bone fractures" → "Bone Fracture Detection", NOT "CNN".
- Be specific but concise. "Medical AI" is too vague. "Diabetic Retinopathy Classification" is better.
- Do NOT include tech skills here (no "Python", "PyTorch", "React", etc.).
- Each domain entry should be 2-4 words maximum.
---

### PART 3 — EXPERIENCE CALCULATION

Today's date is {date.today()}.

**Count these (add up all UNIQUE non-overlapping periods in months):**
  - Full-time jobs, part-time jobs, internships, university research positions.

**Do NOT count:**
  - Courses, training programs, nanodegrees, certifications, volunteering, personal projects, or the university degree itself.

**For ongoing roles** (e.g. "March 2026 - Present"): use today's date ({date.today()}) as end date.

**Output format:** plain integer followed by " months". Example: "16 months".
Never write "1 year 4 months" or "~16 months". If zero qualifying experience: "0 months".

---

### OUTPUT FORMAT (Strict JSON — no extra text, no markdown fences):
{{
    "name": "Full Name",
    "email": "email",
    "phone": "phone",
    "years of experience": "16 months",
    "all_skills": ["Standardized Skill 1", "Standardized Skill 2"],
    "domain_knowledge": ["Medical Imaging", "Stock Market Prediction", "Recommendation Systems"],
    "experience": [
        {{"role": "Job Title", "company": "Company Name", "years": "Jun 2024 - Sep 2024 (3 months)"}}
    ],
    "education": [
        {{"degree": "Degree Name", "institution": "University Name", "technologies": ["Tech 1", "Tech 2"]}}
    ],
    "projects": [
        {{"name": "Project Name", "technologies": ["Tech 1", "Tech 2"]}}
    ],
    "certifications": [
        {{"name": "Cert Name", "technologies": ["Tech 1", "Tech 2"]}}
    ],
    "Publications": [
        {{"name": "Publication Title", "technologies": ["Tech 1", "Tech 2"]}}
    ]
}}
"""