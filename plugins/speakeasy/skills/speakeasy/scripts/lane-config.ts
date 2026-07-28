import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const currentLaneSchemaVersion = 1;
export const laneNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export interface LaneTask {
  id: string;
  title: string;
  cwd: string;
}

export interface LaneVoiceOverride {
  provider: string;
  voiceID: string;
}

export interface VoiceLane {
  number: number;
  label?: string;
  task: LaneTask;
  voiceOverride?: LaneVoiceOverride;
  narrationCue?: string;
  playbackRate?: number;
}

export interface VoiceLaneConfiguration {
  schemaVersion: number;
  activeLane?: number;
  lanes: VoiceLane[];
}

export function defaultLaneConfigurationPath(): string {
  const override = process.env.SPEAKEASY_LANES_PATH;
  if (override?.startsWith("/")) return override;
  return join(homedir(), "Library", "Application Support", "SpeakEasy", "lanes.json");
}

export function normalizeLaneNumber(raw: string | number): number {
  const number = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(number) || number < 1 || number > 9) {
    throw new Error("Lane number must be an integer from 1 through 9.");
  }
  return number;
}

export function normalizeOptionalText(value: unknown, maximum: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maximum) : undefined;
}

export function normalizePlaybackRate(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(Math.max(value, 0.5), 2);
}

function normalizeTask(value: unknown): LaneTask {
  if (!value || typeof value !== "object") throw new Error("Every lane requires a task mapping.");
  const candidate = value as Partial<LaneTask>;
  const id = normalizeOptionalText(candidate.id, 256);
  const title = normalizeOptionalText(candidate.title, 512);
  const cwd = normalizeOptionalText(candidate.cwd, 4096);
  if (!id || !title || !cwd) throw new Error("Lane task id, title, and cwd must all be non-empty.");
  return { id, title, cwd };
}

function normalizeVoice(value: unknown): LaneVoiceOverride | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<LaneVoiceOverride>;
  const provider = normalizeOptionalText(candidate.provider, 80)?.toLowerCase();
  const voiceID = normalizeOptionalText(candidate.voiceID, 256);
  return provider && voiceID ? { provider, voiceID } : undefined;
}

export function normalizeConfiguration(value: unknown): VoiceLaneConfiguration {
  if (!value || typeof value !== "object") throw new Error("lanes.json must contain a JSON object.");
  const candidate = value as Partial<VoiceLaneConfiguration>;
  const schemaVersion = candidate.schemaVersion ?? currentLaneSchemaVersion;
  if (!Number.isInteger(schemaVersion) || schemaVersion > currentLaneSchemaVersion) {
    throw new Error(`Unsupported lane schema version: ${String(schemaVersion)}.`);
  }

  const lanesByNumber = new Map<number, VoiceLane>();
  for (const rawLane of Array.isArray(candidate.lanes) ? candidate.lanes : []) {
    if (!rawLane || typeof rawLane !== "object") continue;
    const lane = rawLane as Partial<VoiceLane>;
    const number = normalizeLaneNumber(lane.number ?? Number.NaN);
    lanesByNumber.set(number, {
      number,
      label: normalizeOptionalText(lane.label, 80),
      task: normalizeTask(lane.task),
      voiceOverride: normalizeVoice(lane.voiceOverride),
      narrationCue: normalizeOptionalText(lane.narrationCue, 240),
      playbackRate: normalizePlaybackRate(lane.playbackRate),
    });
  }

  const lanes = [...lanesByNumber.values()].sort((left, right) => left.number - right.number);
  const requestedActive = candidate.activeLane === undefined
    ? undefined
    : normalizeLaneNumber(candidate.activeLane);
  const activeLane = requestedActive !== undefined && lanes.some((lane) => lane.number === requestedActive)
    ? requestedActive
    : undefined;
  return { schemaVersion: currentLaneSchemaVersion, activeLane, lanes };
}

export async function readLaneConfiguration(
  path = defaultLaneConfigurationPath(),
): Promise<VoiceLaneConfiguration> {
  try {
    const source = await readFile(path, "utf8");
    return normalizeConfiguration(JSON.parse(source));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { schemaVersion: currentLaneSchemaVersion, lanes: [] };
    }
    throw error;
  }
}

export async function writeLaneConfiguration(
  configuration: VoiceLaneConfiguration,
  path = defaultLaneConfigurationPath(),
): Promise<void> {
  const normalized = normalizeConfiguration(configuration);
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, path);
    await chmod(path, 0o600);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

export function displayName(lane: VoiceLane): string {
  return lane.label ?? lane.task.title;
}
