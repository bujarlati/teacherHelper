export type ModelConfig = {
  apiKey: string;
  modelName: string;
};

export type QdrantConfig = {
  mode: "local" | "remote";
  url: string;
  apiKey: string;
  collectionPrefix: string;
};

export type LocalQdrantStatus = {
  mode: "local" | "remote";
  status: "starting" | "running" | "stopped" | "missing" | "failed" | "remote";
  url: string;
  storagePath?: string;
  binaryPath?: string;
  pid?: number;
  managed?: boolean;
  message?: string;
};

export type AppSettings = {
  textModel: ModelConfig;
  videoModel: ModelConfig;
  imageModel: ModelConfig;
  embeddingModel: ModelConfig;
  rerankerModel: ModelConfig;
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
    targetQuantity?: "time" | "distance" | "speed";
    answerValue?: number | string;
    answerUnit?: string;
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

export type LessonImageAsset = {
  title: string;
  prompt: string;
  src: string;
  localPath?: string;
};

export type LocalTeachingDemoInput = {
  prompt: string;
  script?: string;
  exampleQuestions?: Array<{ question: string; answer: string }>;
  workedSolutions?: Array<{ question: string; steps: string[]; answer: string }>;
  imageAssets?: LessonImageAsset[];
};

export type LocalTeachingDemoResult = {
  id: string;
  title: string;
  url: string;
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
  localVideoPath?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
};

export type TextbookImageKind = "page" | "crop";

export type TextbookCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TextbookIndexItem = {
  kind: TextbookImageKind;
  pageNumber: number;
  imageDataUrl: string;
  cropRect?: TextbookCropRect;
  sourceName?: string;
  sourcePageNumber?: number;
};

export type TextbookSource = {
  name: string;
  pageCount: number;
  itemCount: number;
};

export type TextbookRecord = {
  id: string;
  title: string;
  sourceName: string;
  sourceNames?: string[];
  sources?: TextbookSource[];
  collectionName: string;
  pageCount: number;
  itemCount: number;
  status: "indexed" | "failed";
  createdAt: string;
  updatedAt: string;
  error?: string;
};

export type TextbookSearchResult = {
  id: string;
  score: number;
  rerankScore?: number;
  rankingSource: "qdrant" | "reranker";
  rankingMessage?: string;
  textbookId: string;
  title: string;
  sourceName: string;
  pageNumber: number;
  sourcePageNumber?: number;
  kind: TextbookImageKind;
  imagePath: string;
  imageDataUrl?: string;
  cropRect?: TextbookCropRect;
};
