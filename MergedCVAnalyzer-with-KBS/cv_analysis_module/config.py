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
    # --- Specialized Frontend Engineering ---
    "React Frontend Developer": ["React", "JavaScript", "TypeScript", "HTML", "CSS", "Redux", "Tailwind", "REST API"],
    "Vue Frontend Developer": ["Vue", "JavaScript", "TypeScript", "HTML", "CSS", "Vuex", "Pinia", "Tailwind"],
    "Angular Frontend Developer": ["Angular", "TypeScript", "RxJS", "HTML", "CSS", "Jasmine", "Karma"],

    # --- Specialized Backend Engineering ---
    "Django Backend Engineer": ["Python", "Django", "SQL", "PostgreSQL", "REST API", "Docker", "Redis", "Celery"],
    "FastAPI Backend Engineer": ["Python", "FastAPI", "SQL", "PostgreSQL", "REST API", "Docker", "Pydantic"],
    "Node.js Backend Engineer": ["Node.js", "JavaScript", "Express", "MongoDB", "SQL", "REST API", "Docker"],
    "Spring Boot Backend Engineer": ["Java", "Spring Boot", "Hibernate", "SQL", "PostgreSQL", "REST API", "Maven", "Docker"],
    "Go Backend Engineer": ["Go", "gRPC", "SQL", "PostgreSQL", "Docker", "Kubernetes", "Microservices", "REST API"],

    # --- Full-Stack Ecosystems ---
    "MERN Stack Developer": ["MongoDB", "Express", "React", "Node.js", "JavaScript", "REST API", "HTML", "CSS"],
    "Python Full-Stack Developer": ["Python", "Django", "React", "PostgreSQL", "JavaScript", "HTML", "CSS", "Docker"],

    # --- Highly Specialized AI & Data Science ---
    "Data Scientist": ["Python", "Pandas", "NumPy", "SQL", "Statistics", "Scikit-learn", "Jupyter", "Data Visualization"],
    "Data Engineer": ["Python", "SQL", "Apache Spark", "Airflow", "Hadoop", "Kafka", "AWS", "Data Warehousing"],
    "Computer Vision Engineer": ["Python", "OpenCV", "PyTorch", "TensorFlow", "Deep Learning", "Object Detection", "YOLO", "Image Processing"],
    "NLP Engineer": ["Python", "NLP", "Hugging Face", "Transformers", "NLTK", "spaCy", "PyTorch", "Deep Learning"],
    "MLOps Engineer": ["Python", "MLOps", "Docker", "Kubernetes", "MLflow", "CI/CD", "AWS", "GitHub Actions"],

    # --- Generative AI & LLM Specializations ---
    "Generative AI Engineer (Text/LLM)": ["Python", "LLM", "Prompt Engineering", "Fine-tuning", "LoRA", "RAG", "Vector Databases", "LangChain", "PyTorch"],
    "Generative AI Engineer (Vision)": ["Python", "Stable Diffusion", "Diffusion Models", "ControlNet", "ComfyUI", "PyTorch", "Generative Adversarial Networks (GANs)", "Computer Vision"],
    "Generative AI Engineer (Audio/Speech)": ["Python", "Text-to-Speech (TTS)", "Speech-to-Text (STT)", "Whisper", "Audio Processing", "PyTorch", "Deep Learning"],

    # --- Agentic AI Engineering ---
    "AI Agent Engineer": ["Python", "LangChain", "LangGraph", "AutoGen", "Tool Calling", "RAG", "LLM", "API Integration"],
    "Multi-Agent Systems Engineer": ["Python", "CrewAI", "AutoGen", "Multi-Agent Collaboration", "System Design", "LLM", "Semantic Routing"],

    # --- Academic & Research Roles ---
    "AI/ML Researcher": ["Machine Learning", "Deep Learning", "PyTorch", "Publications", "Research", "Mathematics", "Statistics", "Algorithm Design"],
    "Computer Vision Researcher": ["Computer Vision", "PyTorch", "Image Processing", "Object Detection", "Publications", "Research", "Mathematical Modeling"],
    "NLP Researcher": ["NLP", "Transformers", "Large Language Models", "PyTorch", "Linguistics", "Publications", "Research", "Text Analysis"],

    # --- Mobile Engineering ---
    "iOS Developer": ["Swift", "iOS", "Xcode", "UIKit", "SwiftUI", "Core Data"],
    "Android Developer": ["Kotlin", "Android", "Android Studio", "Java", "Jetpack Compose", "Room"],
    "React Native Developer": ["React Native", "JavaScript", "TypeScript", "React", "iOS", "Android"],
    "Flutter Developer": ["Flutter", "Dart", "iOS", "Android", "Firebase"],

    # --- Infrastructure & Security ---
    "Cloud Architect (AWS)": ["AWS", "EC2", "S3", "IAM", "Terraform", "Docker", "Linux", "Serverless"],
    "DevOps Engineer": ["Docker", "Kubernetes", "CI/CD", "Linux", "Terraform", "Jenkins", "Ansible", "Bash"],
    "Cybersecurity Engineer": ["Security", "Penetration Testing", "Cryptography", "Linux", "Networking", "Bash", "Wireshark"],

    # --- Design & Product ---
    "UI/UX Designer": ["Figma", "Adobe XD", "Wireframing", "Prototyping", "User Research", "UI Design", "UX Design"]
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