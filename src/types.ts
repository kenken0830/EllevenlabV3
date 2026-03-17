export const SCHEMA_VERSION = "0.1" as const;
export const SOURCE_NOTE_FILE = "00-source-note.json" as const;
export const MANIFEST_FILE = "manifest.json" as const;
export const STAGES = [
  "brief",
  "spoken-script",
  "eleven-v3-prompt",
  "qa",
] as const;

export type StageName = (typeof STAGES)[number];
export type StageMode = "all" | "stage" | "from";
export type ExecutionMode = "mock" | "real";
export type StageFailureKind =
  | "configuration_error"
  | "refusal"
  | "validation_error"
  | "runtime_error";

export const STAGE_FILE_NAMES: Record<StageName, string> = {
  brief: "01-brief.json",
  "spoken-script": "02-spoken-script.json",
  "eleven-v3-prompt": "03-eleven-v3-prompt.json",
  qa: "04-qa-report.json",
};

export const REQUIRED_PREVIOUS_STAGES: Record<StageName, StageName[]> = {
  brief: [],
  "spoken-script": ["brief"],
  "eleven-v3-prompt": ["spoken-script"],
  qa: ["brief", "spoken-script", "eleven-v3-prompt"],
};

export interface GenerateCliOptions {
  command: "generate";
  inputPath: string;
  outputDir: string;
  stage?: StageName;
  fromStage?: StageName;
  mock: boolean;
}

export interface QaCliOptions {
  command: "qa";
  outputDir: string;
}

export interface HelpCliOptions {
  command: "help";
}

export type CliOptions = GenerateCliOptions | QaCliOptions | HelpCliOptions;

export interface SourceNoteArtifact {
  artifact_type: "source_note";
  version: typeof SCHEMA_VERSION;
  id: string;
  title: string;
  source_path: string;
  body: string;
  metadata: Record<string, string>;
}

export interface BriefSection {
  id: "intro" | "body" | "close";
  goal: string;
  points: string[];
}

export interface BriefArtifact {
  artifact_type: "brief";
  version: typeof SCHEMA_VERSION;
  source_note: {
    id: string;
    title: string;
  };
  core_message: string;
  listener_problem: string;
  empathy_hook: string;
  talking_points: string[];
  section_plan: BriefSection[];
  body_role: "recognition_reframe";
  close_role: "single_soft_action";
  close_action: string;
  style_targets: string[];
  style_avoid: string[];
}

export interface SpokenScriptSection {
  id: "intro" | "body" | "close";
  purpose: string;
  lines: string[];
}

export interface SpokenScriptArtifact {
  artifact_type: "spoken_script";
  version: typeof SCHEMA_VERSION;
  source_brief: {
    id: string;
  };
  voice_intent: string;
  sections: SpokenScriptSection[];
  closing_takeaway: string;
  delivery_cautions: string[];
}

export interface ElevenV3PromptArtifact {
  artifact_type: "eleven_v3_prompt";
  version: typeof SCHEMA_VERSION;
  source_script: {
    id: string;
  };
  performance_goal: string;
  performance_rules: string[];
  avoid_rules: string[];
  final_prompt: string;
}

export interface QaScore {
  score: number;
  reason: string;
}

export interface QaCheck {
  name: string;
  status: "pass" | "fail";
}

export interface QaIssue {
  severity: "low" | "medium" | "high";
  stage: StageName;
  message: string;
}

export interface QaRevisionGuidance {
  stage: StageName;
  action: string;
}

export interface QaReportArtifact {
  artifact_type: "qa_report";
  version: typeof SCHEMA_VERSION;
  inputs: {
    note_id: string;
  };
  scores: {
    hook_strength: QaScore;
    low_explainer_tone: QaScore;
    spoken_naturalness: QaScore;
    emotion_curve: QaScore;
    eleven_prompt_naturalness: QaScore;
  };
  checks: QaCheck[];
  issues: QaIssue[];
  revision_guidance: QaRevisionGuidance[];
  overall_pass: boolean;
}

export interface StageResultRecord {
  status: "pending" | "loaded" | "completed" | "failed";
  file_name?: string;
  mode?: ExecutionMode;
  validated?: boolean;
  error_kind?: StageFailureKind;
  error_message?: string;
}

export interface ManifestFiles {
  source_note: typeof SOURCE_NOTE_FILE;
  manifest: typeof MANIFEST_FILE;
  planned_stage_files: Partial<Record<StageName, string>>;
}

export interface RunManifest {
  schema_version: typeof SCHEMA_VERSION;
  run_name: string;
  command: "generate";
  input_file: string;
  output_dir: string;
  created_at: string;
  stage_mode: StageMode;
  stages_requested: StageName[];
  mock_mode: boolean;
  execution_mode: ExecutionMode;
  status: "running" | "completed" | "failed";
  last_stage_completed?: StageName;
  failed_stage?: StageName;
  error?: {
    kind: StageFailureKind;
    message: string;
  };
  stage_results: Partial<Record<StageName, StageResultRecord>>;
  files: ManifestFiles;
}

export interface PipelineArtifactBundle {
  sourceNote: SourceNoteArtifact;
  manifest: RunManifest;
  brief?: BriefArtifact;
  spokenScript?: SpokenScriptArtifact;
  elevenV3Prompt?: ElevenV3PromptArtifact;
  qaReport?: QaReportArtifact;
}

export interface PipelineRunErrorInfo {
  stage: StageName;
  kind: StageFailureKind;
  message: string;
}
