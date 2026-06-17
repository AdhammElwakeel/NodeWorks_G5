export const BACKEND_MISMATCH_NOTICE =
  "Disabled because this feature does not currently have a supported backend endpoint.";

export const BACKEND_FEATURES = {
  cvAnalysis: true,
  kbsSync: true,
  recommendations: true,
  skillSuggestions: true,
  aiInterview: false,
} as const;
