export type ModelConfig = {
  apiKey: string;
  modelName: string;
};

export type QdrantConfig = {
  url: string;
  apiKey: string;
  collectionPrefix: string;
};

export type AppSettings = {
  textModel: ModelConfig;
  videoModel: ModelConfig;
  embeddingModel: ModelConfig;
  qdrant: QdrantConfig;
};

export type KnowledgeConnectionTestResult = {
  embedding: "ok";
  qdrant: "ok";
};

export type LessonPlan = {
  title: string;
  grade_suggestion: string;
  teaching_goals: string[];
  key_points: string[];
  difficult_points: string[];
  common_confusions: string[];
  lesson_flow: Array<{ title: string; minutes: number; activities: string[] }>;
  board_design: string[];
  example_questions: Array<{ question: string; answer: string }>;
  worked_solutions: Array<{ question: string; steps: string[]; answer: string }>;
  classroom_questions: string[];
  homework_suggestions: string[];
  video_script: string;
  video_prompt: string;
  markdown: string;
};

export type DemoKind = "motion" | "equation" | "engineering" | "geometry" | "simple";

export type ProblemDemoPlan = {
  kind: DemoKind;
  title: string;
  originalProblem: string;
  knownValues: Array<{ label: string; value: number | string; unit?: string }>;
  target: string;
  steps: string[];
  motion?: {
    startLabel: string;
    endLabel: string;
    distance: number;
    distanceUnit: string;
    speed: number;
    speedUnit: string;
    answerSeconds: number;
  };
  equation?: {
    variable: string;
    relationship: string;
    expression: string;
    solution: string;
    verification: string;
  };
};

export type VideoTaskStatus = "Succeed" | "InQueue" | "InProgress" | "Failed";

export type VideoImageSize = "1280x720" | "720x1280" | "960x960";

export type VideoGenerateInput = {
  prompt: string;
  script: string;
  imageDataUrl?: string;
  imageSize: VideoImageSize;
  negativePrompt?: string;
};

export type VideoTask = {
  id: string;
  requestId: string;
  status: VideoTaskStatus;
  prompt: string;
  script: string;
  imageSize?: string;
  negativePrompt?: string;
  videoUrl?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
};
