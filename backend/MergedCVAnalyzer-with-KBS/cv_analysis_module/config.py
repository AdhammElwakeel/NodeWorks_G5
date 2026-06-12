import os
from dotenv import load_dotenv
from datetime import date
# Load .env variables
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
ZHIPUAI_API_KEY = os.getenv("ZHIPUAI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# ------------------------------------------------------------------
# 🤖 MODEL CONFIGURATION
# ------------------------------------------------------------------
MODEL_NAME = "gemini-2.5-flash" 
# MODEL_NAME = "gemini-pro" 
# MODEL_NAME = "glm-4.7-flash" # Use GLM 4.7 Flash (free version)
# MODEL_NAME = "glm-4"
# MODEL_NAME = "nvidia/nemotron-3-super-120b-a12b:free" 
# MODEL_NAME = "google/gemini-2.0-flash-exp:free" # Faster OpenRouter model

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
# We inject the TECH_ROLES into the prompt so Gemini knows the standards.
# ------------------------------------------------------------------
roles_str = ""
for role, skills in TECH_ROLES.items():
    roles_str += f"- {role} requires: {', '.join(skills)}\n"

CV_PARSER_PROMPT = f"""
You are an expert Technical Recruiter AI. 
Your job is to extract structured data from a resume.

### CRITICAL INSTRUCTION: INTELLIGENT SKILL MAPPING
You must infer and normalize skills to match our Standard Technology List.
If a candidate mentions a specific tool or concept that implies a standard skill, you MUST output the Standard Skill name.

**Our Standard Roles & Skills:**
{roles_str}

**Mapping Rules (Apply these logic steps):**
1. **Synonyms:** If resume says "Large Language Models", you output "LLM". If "React.js", output "React".
2. **Implication:** - "Vision Transformers" or "BERT" -> implies "Transformers" AND "Deep Learning".
   - "AWS EC2" -> implies "AWS".
   - "Android Studio" -> implies "Android".
3. **Context:** Look at Projects/Research. If they used "YOLO" (Object Detection), add "Deep Learning" and "OpenCV" if implied.
4. **Words class:** if the subskill comes under a large skills include the large skill,e.g. if they used Pandas/data manipulation, add "Data preprocessing", "Data Visualization" and so on.
5. **Research Inference (CRITICAL):** If the candidate lists any published papers, journals, or mentions academic research, you MUST add "Publications" and "Research" to their `all_skills` array. If they have a Master's (MSc) or PhD focused on thesis work, also add "Research".
6. **Agentic/GenAI Inference:** If they mention building "AI Agents", "Agentic Workflows", or use frameworks like CrewAI/AutoGen/LangGraph, add "Tool Calling" and "Multi-Agent Collaboration" to `all_skills` if implied.
7. **time*:* today is {date.today()}, you will need this in calculating the years of experience.

### OUTPUT FORMAT (Strict JSON)
{{
    "name": "Full Name",
    "email": "email",
    "phone": "phone",
    "years of experience":"48 months",
    "all_skills": ["Standardized Skill 1", "Standardized Skill 2", ...],
    "experience": [
        {{"role": "Job Title", "company": "Company Name", "years": "Duration"}}
    ],
    "education": [
        {{"degree": "Degree Name", "institution": "University Name","technologies": ["Tech 1", "Tech 2"]}}
    ],
    "projects": [
        {{"name": "Project Name", "technologies": ["Tech 1", "Tech 2"]}}
    ],
    "certifications": [
    {{"name":"Cert 1", "technologies": ["Tech 1", "Tech 2"]}}
    ],
    "Publications": [
    {{"name":"publication 1", "technologies": ["Tech 1", "Tech 2"]}}
    ]
}}
"""