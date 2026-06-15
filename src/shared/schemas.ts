import { z } from "zod";

export const modelConfigSchema = z.object({
  apiKey: z.string(),
  modelName: z.string()
});

export const appSettingsSchema = z.object({
  textModel: modelConfigSchema,
  videoModel: modelConfigSchema
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
    answerSeconds: z.number().positive()
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
