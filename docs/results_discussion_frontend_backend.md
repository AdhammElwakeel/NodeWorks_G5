# Chapter 5: Results

## 5.1 Introduction

This chapter presents the results obtained from implementing the AI-Powered Smart Freelance and Knowledge-Based Team Formation Platform. The evaluation covers both the frontend and backend components because the success of the project depends on two connected outcomes: providing a usable role-based web experience for freelancers and clients, and delivering reliable intelligent services for CV analysis, AI interview assessment, Knowledge Graph synchronization, and recommendation generation.

The frontend was evaluated according to workflow completion, usability, responsiveness, API integration, feedback handling, and client-side interview integrity monitoring. The backend was evaluated according to API availability, correctness of data processing, Knowledge Graph synchronization, scoring consistency, recommendation relevance, and service reliability. Since the repository does not contain a formal benchmark report or automated end-to-end test suite, the results focus on implemented functionality, scenario-based validation, code-level verification, and measurable scoring formulas used by the system.

## 5.2 Performance Metrics

The following metrics were used to evaluate the implemented system.

### 5.2.1 Frontend Metrics

| Metric | Definition | Purpose |
| --- | --- | --- |
| Workflow completion | Whether the user can complete a full role-based flow from login to the final action | Measures practical usability for freelancers and clients |
| Page responsiveness | Whether pages adapt correctly to different screen sizes and keep actions accessible | Measures interface usability across desktop and mobile |
| API integration coverage | Number of backend features exposed through the frontend | Measures whether intelligent backend services are usable from the web app |
| Feedback visibility | Presence of loading, success, empty, and error states | Measures clarity during long-running operations such as CV analysis or recommendations |
| Role-based access behavior | Whether freelancer and client pages expose the correct actions to the correct users | Measures security and workflow separation |
| Interview integrity event capture | Detection of tab switching, paste attempts, gaze/face issues, and related warnings | Measures frontend support for trustworthy AI interview assessment |

### 5.2.2 Backend Metrics

| Metric | Definition | Purpose |
| --- | --- | --- |
| API availability | Whether required service endpoints are implemented and expose health/status responses | Measures basic service readiness |
| CV extraction completeness | Whether uploaded CVs are transformed into structured profile fields | Measures AI-based profile creation |
| Role-fit score | Numerical score showing how well a freelancer matches predefined technical roles | Measures candidate-role suitability |
| Interview verification score | Final interview score after answer grading and integrity penalties | Measures skill validation and trust |
| Knowledge Graph sync success | Whether freelancer and project data are written to Neo4j as nodes and relationships | Measures readiness for graph reasoning |
| Recommendation relevance score | Weighted score combining skill match, experience, project evidence, and role fit | Measures quality of freelancer/project matching |
| Team coverage score | Percentage of required project skills covered by the selected team | Measures completeness of generated teams |
| Team synergy score | Additional score based on shared graph entities between team members | Measures contextual compatibility |
| Backend syntax validity | Whether Python backend modules compile successfully | Measures implementation correctness at code level |

The backend uses explicit formulas for the most important intelligent metrics. For CV role scoring, the system calculates:

```text
skill_score = matched_required_skills / total_required_skills * 100
experience_bonus = min(years_of_experience / 3, 1) * 100
final_role_score = (skill_score * 0.80) + (experience_bonus * 0.20)
```

For graph-based job and freelancer recommendations, the backend calculates:

```text
recommendation_score =
  (skillScore * 0.40)
  + (experienceScore * 0.30)
  + (projectEvidenceScore * 0.20)
  + (roleScore * 0.10)
```

For team formation, the system calculates skill coverage and then ranks teams using a final score based on technical coverage and graph-based synergy:

```text
coverage_score = covered_required_skills / total_required_skills * 100
final_team_score = technical_score + (synergy_score * 0.01)
```

## 5.3 Evaluation Methodology

The evaluation methodology followed a scenario-based approach. Instead of testing isolated functions only, the system was evaluated through complete user journeys that reflect how the platform is expected to be used in practice.

For the frontend, the methodology included checking the main role-based workflows: freelancer registration and onboarding, CV upload, profile completion, AI interview completion, job browsing, proposal submission, client project creation, project management, recommendation viewing, and messaging. The interface was also inspected for loading states, error messages, empty states, and role-specific navigation.

For the backend, the methodology included verifying the presence and behavior of the main API endpoints. These include CV analysis, AI interview start/submission/reporting, project skill suggestion, KBS health checking, freelancer and project ingestion into Neo4j, job recommendation, freelancer recommendation, and team recommendation. The scoring logic was evaluated by inspecting the formulas implemented in the CV scorer and the Neo4j recommendation queries.

Static validation was also performed. Python backend modules were checked using Python compilation, which completed successfully. The frontend lint command was executed and identified issues that should be resolved before final production delivery, mainly linting of the vendored `face-api.esm.js` file, broad `any` TypeScript types, JSX escaping warnings, and a React hook/state warning.

## 5.4 Frontend Results

The frontend implementation achieved the main user-facing objectives of the platform. It provides a role-based Next.js application with separate experiences for freelancers and clients.

For freelancers, the frontend supports onboarding through three connected steps: CV upload, profile completion, and AI interview. The CV upload page sends the uploaded PDF to the CV analysis API and displays progress and error states. Extracted CV data is used to pre-fill profile information, including skills, experience, projects, education, role rankings, and best role. After profile completion, the freelancer can complete an AI interview that uses the extracted skills as the basis for technical questions. The interview result is stored in the freelancer profile and later used as a trust signal.

The freelancer dashboard presents open jobs and KBS-based recommendations. Recommended jobs include score explanations such as matched skills, missing skills, role evidence, experience evidence, and project evidence. This is important because the platform does not only show a recommendation score; it also explains why a project is suitable for the freelancer. Freelancers can also apply to projects, view proposal status, manage their profile, and use the messaging feature.

For clients, the frontend supports onboarding, project creation, project editing, proposal review, freelancer discovery, and project-specific recommendation pages. Clients can create projects with title, description, budget, timeline, required skills, and hiring mode. The frontend integrates with the project skill suggestion service, allowing the backend LLM service to suggest missing or relevant skills from the project description. Clients can then view recommended freelancers and recommended teams for a project.

The frontend also implements the interview proctoring layer. It uses browser events and face detection assets to detect tab switching, paste attempts, and gaze/face issues. These events are sent to the backend as interview violations, where they are included in the final scoring penalty. This result supports the project's trust objective because the platform does not rely only on self-declared skills.

Overall, the frontend result is a complete interactive prototype rather than a static demonstration. It connects authentication, dashboards, onboarding, CV analysis, AI interview, proposals, messaging, KBS synchronization, and recommendations into a single web application.

## 5.5 Backend Results

The backend implementation achieved the main intelligence and data-processing objectives of the project. It combines Next.js API routes for application data with a FastAPI service for AI, KBS, and recommendation operations.

The CV analysis backend accepts PDF files, extracts their content, and passes the extracted text to the selected AI provider. The output is normalized into structured data such as name, email, headline, skills, domain knowledge, education, experience, projects, certifications, publications, role rankings, best role, and best score. The role scoring algorithm improves on keyword matching by combining skill coverage with an experience factor. This prevents a candidate with no experience from receiving the same score as an experienced candidate, while still allowing strong students or juniors to receive high scores when their skill match is strong.

The AI interview backend creates interview sessions from the freelancer's extracted skills. It generates main questions and follow-up questions, grades technical answers, calculates English-language scores, records violations, applies penalties, and returns a final report. The report includes overall score, raw score, verification status, skill-level scores, strong skills, cheating indicators, penalties, and badge tier. The verification threshold and penalty values are configurable through environment variables, which makes the module adaptable.

The Knowledge Graph backend writes freelancer and project data into Neo4j. Freelancer ingestion creates or updates nodes and relationships for skills, domains, companies, institutions, CV projects, technologies, roles, and role scores. Project ingestion creates project nodes, required skill relationships, derived role requirements, and team-size information. This result is important because it transforms profile and project data into graph knowledge that can be traversed for recommendation and explanation.

The recommendation backend implements three recommendation modes:

1. Job recommendations for freelancers.
2. Freelancer recommendations for client projects.
3. Team recommendations for client projects.

Job and freelancer recommendations use a weighted score based on required skill match, experience evidence, CV project evidence, and role match. The system also returns a score breakdown and explanation fields. Team recommendation uses skill coverage and graph-based synergy to build teams that cover the required project skills while considering shared entities between candidates. This supports the project's goal of moving beyond individual hiring toward intelligent team formation.

The Docker configuration also demonstrates deployment readiness. The system defines services for the Next.js frontend, the FastAPI backend, Neo4j, and MongoDB. Environment variables are used for database credentials, AI provider keys, service URLs, and model configuration.

## 5.6 Testing Scenarios and Case Studies

### 5.6.1 Case Study 1: Freelancer Onboarding

The freelancer onboarding scenario begins when a freelancer registers and uploads a PDF CV. The frontend sends the file to the CV analysis endpoint. The backend extracts structured CV information and returns role rankings and skill data. The freelancer then completes profile fields and proceeds to the AI interview. After the interview, the report is saved with the profile.

Expected result: the freelancer profile contains manually entered information, AI-extracted CV information, role-fit scores, and AI interview verification results.

Obtained result: the implemented frontend and backend support the full onboarding chain and store the output in the freelancer profile model.

### 5.6.2 Case Study 2: Client Project Creation and Skill Suggestion

In this scenario, a client creates a new project by entering title, description, budget, timeline, required skills, and hiring mode. The frontend can request AI skill suggestions based on the project title and description. The project is stored in MongoDB and can be synchronized to Neo4j.

Expected result: the project becomes available for browsing, matching, and recommendation.

Obtained result: the implemented system supports project creation, skill suggestion, project storage, and KBS synchronization status tracking.

### 5.6.3 Case Study 3: Freelancer Job Recommendation

In this scenario, a freelancer opens the dashboard and requests recommended jobs. The frontend calls the recommendation API. If the freelancer is not already synchronized with the KBS, the system attempts to sync the profile first. The backend then queries Neo4j and ranks open projects using the weighted recommendation score.

Expected result: the freelancer receives a ranked list of suitable projects with score explanations.

Obtained result: the implemented recommendation response includes the recommended project, score, matched skills, missing skills, required skills, role evidence, score breakdown, experience details, and project evidence details.

### 5.6.4 Case Study 4: Client Freelancer and Team Recommendation

In this scenario, a client views a project and requests recommended freelancers or teams. The system excludes users who already submitted proposals, synchronizes the project if needed, and calls the recommendation backend.

Expected result: the client receives ranked freelancers and possible teams aligned with project requirements.

Obtained result: the implemented backend returns freelancer recommendations with score explanations and team recommendations with required skills, required roles, covered skills, missing skills, coverage score, technical score, synergy score, and member-level skill coverage.

### 5.6.5 Case Study 5: Interview Integrity Monitoring

In this scenario, a freelancer takes the AI interview while the frontend monitors tab switching, paste attempts, and gaze/face behavior. When a violation is detected, the frontend reports it to the backend. The backend stores the violation and includes it in the final penalty.

Expected result: suspicious behavior reduces the final interview score or prevents verification when violations become severe.

Obtained result: the implemented backend applies violation penalties and marks cheating indicators in the final interview report.

## 5.7 Verification and Validation

Verification confirms whether the system was built correctly according to the design, while validation confirms whether the system satisfies the intended user needs.

Frontend verification included checking that the main pages and components exist for landing, authentication, freelancer onboarding, freelancer dashboard, freelancer profile, job application, client onboarding, client dashboard, project management, proposals, messages, and recommendation views. API wrapper functions are implemented for authentication, profile management, projects, proposals, skills, CV upload, AI interview, messages, recommendations, and KBS synchronization.

Backend verification included checking that the main FastAPI endpoints exist for CV analysis, AI interviews, project skill suggestion, KBS health, KBS ingestion, and recommendations. Python compilation completed successfully for the backend modules and related AI/KBS modules, indicating that the checked Python files are syntactically valid.

Validation was performed through the end-to-end scenarios described above. These scenarios confirm that the platform addresses the core needs of the two target user groups: freelancers need a way to prove and present their skills, while clients need a way to find individual freelancers or teams with explainable evidence.

The current frontend lint validation identified remaining implementation cleanup tasks. The command reported issues caused by the vendored face-api JavaScript file being included in linting, repeated broad `any` types in API routes, some image optimization warnings, JSX escaping issues, and a React hook/state warning. These issues do not remove the implemented functionality, but they should be addressed before production release to improve maintainability and code quality.

## 5.8 Summary of Key Findings

The first key finding is that the implemented system successfully connects the frontend and backend into a full workflow. Freelancer onboarding, CV analysis, AI interview, profile storage, project creation, KBS synchronization, and recommendations are integrated rather than implemented as disconnected prototypes.

The second key finding is that the Knowledge Graph improves recommendation transparency. Instead of returning only a ranked list, the backend returns matched skills, missing skills, role evidence, experience evidence, project evidence, and score breakdowns. This supports explainable matching and improves client trust.

The third key finding is that team formation is feasible using graph-based skill coverage. The team recommendation module can build teams based on required skills, member skill coverage, technical score, missing skills, and shared graph entities. This directly supports the project's objective of moving from individual freelance hiring to team-based hiring.

The fourth key finding is that trust signals are represented across multiple layers. CV analysis extracts claimed skills, the interview verifies a sample of those skills, proctoring events penalize suspicious behavior, and the Knowledge Graph stores structured relationships for future recommendations.

The fifth key finding is that the project is functionally strong but still needs final engineering hardening. The backend Python syntax validation passed, but frontend linting requires cleanup, and the repository does not yet include a formal automated test suite or saved benchmark results.

# Chapter 6: Discussion

## 6.1 Interpretation of Results

The obtained results show that the platform meets the main technical direction proposed in the earlier chapters. The frontend provides the interaction layer needed by freelancers and clients, while the backend provides the intelligence layer needed for analysis, verification, graph construction, and recommendation. Together, these two parts demonstrate that the project is not only a marketplace interface, but a trust-aware hiring system.

From the frontend perspective, the most important result is workflow completeness. Freelancers can move from CV upload to AI interview and then to job recommendations. Clients can move from project creation to recommendation review. This validates the usability objective because the complex AI and graph features are exposed through understandable user journeys instead of requiring users to interact with backend tools directly.

From the backend perspective, the most important result is the conversion of unstructured and semi-structured data into decision-ready knowledge. CV files are converted into structured candidate profiles, profile data is converted into graph nodes and relationships, project descriptions are converted into required skills and derived roles, and graph queries are converted into explainable recommendation outputs.

The scoring results also show that the platform avoids the limitations of simple keyword search. A freelancer is not ranked only because a skill name appears in a profile. The system also considers experience evidence, role-fit scores, CV project evidence, and the percentage of project requirements covered. This makes the recommendation process more transparent and more aligned with real hiring needs.

## 6.2 Significance of the Findings

The findings are significant because they address the main gap identified in the project: existing freelance platforms are mostly individual-centric and rely heavily on manual search, keyword filtering, and subjective ratings. The implemented platform introduces a more structured process where freelancers are evaluated, represented in a Knowledge Graph, and recommended based on explainable evidence.

For freelancers, the system creates a better way to prove ability. A freelancer's profile is supported by extracted CV data, role-fit scoring, AI interview results, and project evidence. This is especially useful for students, juniors, and early-career freelancers who may not have many platform reviews but can still demonstrate strong technical skills.

For clients, the system reduces the effort required to find suitable talent. Instead of manually comparing many profiles, the client receives ranked freelancers and teams with explicit explanations. This improves trust because the client can see which skills were matched, which skills are missing, and how the recommendation score was formed.

For team-based freelance work, the results are particularly important. The implemented team recommendation module shows that teams can be generated based on skill coverage and graph relationships. This supports the project's larger goal of enabling virtual agency formation rather than only one-to-one hiring.

## 6.3 Limitations

Several limitations were encountered during implementation and evaluation.

First, AI-dependent operations rely on external model providers. CV extraction, interview question generation, grading, and skill suggestion may be affected by API availability, response time, cost, model changes, and network conditions. This means that performance can vary between environments.

Second, the repository does not contain a saved formal benchmark dataset or automated load-test report. As a result, exact numerical latency and throughput results should be measured again before final deployment. The implementation supports performance evaluation, but the documented evidence is mainly functional and code-based rather than benchmark-based.

Third, frontend linting is not yet clean. The latest lint execution reported errors and warnings, including vendored face-api code being linted, broad TypeScript `any` usage, JSX escaping issues, image optimization warnings, and a React hook/state warning. These issues should be resolved before production release.

Fourth, the interview proctoring system is mainly client-side. It can detect useful signals such as tab switching, paste attempts, and gaze/face issues, but client-side proctoring cannot be considered fully tamper-proof. Stronger production validation would require secure session recording, server-side audit logs, or additional identity verification.

Fifth, the team synergy calculation is an initial implementation. It considers technical coverage and shared graph entities, but it does not yet fully model deeper collaboration quality, communication style, availability overlap, personality compatibility, or historical team performance.

Sixth, the recommendation quality depends heavily on data quality. If CV extraction misses skills, if users enter incomplete profiles, or if projects have vague descriptions, the graph will contain weaker evidence and recommendations may be less accurate.

## 6.4 Alignment with Project Objectives

The results align with the four main phases defined in the project work plan.

The Trust Foundation objective is addressed through CV upload, AI-based CV analysis, structured data extraction, role scoring, and profile storage. The system can transform unstructured CVs into profile data that can be evaluated and reused.

The AI Interview objective is addressed through dynamic question generation, follow-up questions, technical answer grading, English scoring, violation handling, final interview reports, verification status, and badge tiers.

The Intelligence Layer objective is addressed through Neo4j Knowledge Graph construction, freelancer ingestion, project ingestion, role derivation, graph relationships, recommendation scoring, and team formation logic.

The Scale and Integration objective is addressed through the full-stack architecture. The frontend is implemented in Next.js, application data is handled through MongoDB-backed API routes, intelligent processing is handled through FastAPI services, graph reasoning is handled through Neo4j, and Docker Compose defines a deployable multi-service environment.

Overall, the implemented results match the expected outcome of building an AI-powered freelance platform that supports trust, verification, explainability, and team-based recommendation.

## 6.5 Final Discussion

The project demonstrates that a freelance platform can be improved by combining web application workflows with AI assessment and Knowledge Graph reasoning. The frontend makes the system accessible to real users, while the backend provides the intelligent processing required to move beyond ordinary profile search.

The strongest outcome is the integration between verification and recommendation. CV analysis and AI interviews are not isolated features; their results become structured evidence that can influence matching and team formation. This creates a more trustworthy recommendation pipeline because decisions are based on extracted skills, assessed performance, role fit, project evidence, and graph relationships.

At the same time, the project should be treated as a strong functional prototype rather than a fully production-hardened system. Before production deployment, the team should add automated unit and end-to-end tests, clean frontend lint issues, exclude vendored libraries from linting, create a benchmark dataset, run repeatable latency tests, improve proctoring security, and expand the team synergy model.

In conclusion, the frontend and backend results support the original project objectives. The system provides a practical web interface for freelancers and clients, implements AI-powered verification, stores knowledge in a graph structure, and generates explainable recommendations for both individual freelancers and teams. These findings confirm the feasibility of a trust-driven, Knowledge-Based freelance team formation platform.
