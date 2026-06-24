import { z } from "zod";

export const modelConfigSchema = z.object({
  apiKey: z.string(),
  modelName: z.string()
});

export const defaultEmbeddingModelName = "Qwen/Qwen3-VL-Embedding-8B";
export const defaultRerankerModelName = "Qwen/Qwen3-VL-Reranker-8B";
export const defaultImageModelName = "Tongyi-MAI/Z-Image";
export const defaultQdrantUrl = "http://127.0.0.1:6333";
export const defaultQdrantCollectionPrefix = "teacherhelper";
export const defaultVideoStorageDirectory = "";

export const qdrantConfigSchema = z.object({
  mode: z.enum(["local", "remote"]).default("local"),
  url: z.string().default(defaultQdrantUrl),
  apiKey: z.string().default(""),
  collectionPrefix: z.string().default(defaultQdrantCollectionPrefix)
});

export const demoGenerationConfigSchema = z.object({
  mode: z.enum(["template", "ai_html"]).default("template")
});

export const videoStorageConfigSchema = z.object({
  directory: z.string().default(defaultVideoStorageDirectory)
});

export const appSettingsSchema = z.object({
  textModel: modelConfigSchema,
  videoModel: modelConfigSchema,
  imageModel: modelConfigSchema.default({
    apiKey: "",
    modelName: defaultImageModelName
  }),
  embeddingModel: modelConfigSchema.default({
    apiKey: "",
    modelName: defaultEmbeddingModelName
  }),
  rerankerModel: modelConfigSchema.default({
    apiKey: "",
    modelName: defaultRerankerModelName
  }),
  qdrant: qdrantConfigSchema.default({
    mode: "local",
    url: defaultQdrantUrl,
    apiKey: "",
    collectionPrefix: defaultQdrantCollectionPrefix
  }),
  demoGeneration: demoGenerationConfigSchema.default({
    mode: "template"
  }),
  videoStorage: videoStorageConfigSchema.default({
    directory: defaultVideoStorageDirectory
  })
});

export const lessonPlanSchema = z.object({
  title: z.string().min(1),
  grade_suggestion: z.string().min(1),
  teaching_goals: z.array(z.string().min(1)),
  key_points: z.array(z.string().min(1)),
  difficult_points: z.array(z.string().min(1)),
  common_confusions: z.array(z.string().min(1)),
  lesson_flow: z.array(z.object({
    title: z.string().min(1),
    minutes: z.number().nonnegative(),
    activities: z.array(z.string().min(1))
  })),
  board_design: z.array(z.string().min(1)),
  example_questions: z.array(z.object({
    question: z.string().min(1),
    answer: z.string().min(1)
  })),
  worked_solutions: z.array(z.object({
    question: z.string().min(1),
    steps: z.array(z.string().min(1)),
    answer: z.string().min(1)
  })),
  classroom_questions: z.array(z.string().min(1)),
  homework_suggestions: z.array(z.string().min(1)),
  video_script: z.string().min(1),
  video_prompt: z.string().min(1),
  markdown: z.string().min(1)
});

export const problemDemoPlanSchema = z.object({
  kind: z.enum(["motion", "equation", "engineering", "geometry", "simple"]),
  title: z.string().min(1),
  originalProblem: z.string().min(1),
  knownValues: z.array(z.object({
    label: z.string().min(1),
    value: z.union([z.number(), z.string()]),
    unit: z.string().optional()
  })),
  target: z.string().min(1),
  steps: z.array(z.string().min(1)),
  motion: z.object({
    startLabel: z.string().min(1),
    endLabel: z.string().min(1),
    distance: z.number().positive(),
    distanceUnit: z.string().min(1),
    speed: z.number().positive(),
    speedUnit: z.string().min(1),
    answerSeconds: z.number().positive(),
    targetQuantity: z.string().min(1).optional(),
    answerLabel: z.string().min(1).optional(),
    answerValue: z.union([z.number(), z.string()]).optional(),
    answerUnit: z.string().optional()
  }).optional(),
  equation: z.object({
    variable: z.string().min(1),
    relationship: z.string().min(1),
    expression: z.string().min(1),
    solution: z.string().min(1),
    verification: z.string().min(1)
  }).optional()
}).superRefine((value, ctx) => {
  if (value.kind === "motion" && !value.motion) {
    ctx.addIssue({ code: "custom", message: "motion plan requires motion data", path: ["motion"] });
  }

  if (value.kind === "equation" && !value.equation) {
    ctx.addIssue({ code: "custom", message: "equation plan requires equation data", path: ["equation"] });
  }
});

export const videoStatusSchema = z.enum(["Succeed", "InQueue", "InProgress", "Failed"]);
