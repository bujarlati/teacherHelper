type CreateVideoSegmentPromptInput = {
  prompt: string;
  script?: string;
  index: number;
  total: number;
  duration: number;
  referencePrevious?: boolean;
};

export function createVideoSegmentPrompt(input: CreateVideoSegmentPromptInput): string {
  const basePrompt = removeFullScriptFromPrompt(input.prompt, input.script);
  const scenes = splitScriptIntoScenes(input.script);
  const segmentScenes = selectSegmentScenes(scenes, input.index, input.total);

  return [
    basePrompt,
    `这是完整教学视频的第 ${input.index}/${input.total} 段，本段约 ${input.duration} 秒。`,
    segmentScenes.length > 0
      ? [
        "本段只呈现以下脚本场景，不要重复其他片段已经讲过或稍后才讲的场景：",
        ...segmentScenes.map((scene, sceneIndex) => `${sceneIndex + 1}. ${scene}`)
      ].join("\n")
      : "本段承接完整教学视频的当前位置，只推进一个新的清晰小步骤，不要重复其他片段。",
    input.referencePrevious
      ? "请以上一段视频作为连续性参考，延续相同角色、构图、板书、配色、镜头运动和讲解节奏。"
      : "请保持与前后片段的视觉风格、角色、板书和讲解节奏一致，结尾自然衔接下一段。"
  ].join("\n");
}

function removeFullScriptFromPrompt(prompt: string, script: string | undefined): string {
  const trimmedScript = script?.trim();
  if (!trimmedScript) {
    return prompt.trim();
  }

  return prompt
    .replace(`镜头脚本：${trimmedScript}`, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitScriptIntoScenes(script: string | undefined): string[] {
  const trimmedScript = script?.trim();
  if (!trimmedScript) {
    return [];
  }

  const lineScenes = trimmedScript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lineScenes.length > 1) {
    return lineScenes;
  }

  return trimmedScript
    .split(/(?<=[。；;！？!?])\s*/u)
    .map((scene) => scene.trim())
    .filter(Boolean);
}

function selectSegmentScenes(scenes: string[], index: number, total: number): string[] {
  if (scenes.length === 0) {
    return [];
  }

  if (scenes.length < total) {
    return [scenes[Math.min(index - 1, scenes.length - 1)]];
  }

  const start = Math.floor(((index - 1) * scenes.length) / total);
  const end = Math.max(start + 1, Math.floor((index * scenes.length) / total));
  return scenes.slice(start, end);
}
