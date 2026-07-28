#!/usr/bin/env bun

import { resolve } from "node:path";
import {
  defaultLaneConfigurationPath,
  displayName,
  normalizeLaneNumber,
  normalizeOptionalText,
  readLaneConfiguration,
  type VoiceLane,
  writeLaneConfiguration,
} from "./lane-config";

const args = Bun.argv.slice(2);

function has(flag: string): boolean {
  return args.includes(flag);
}

function valueFor(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function laneFor(flag: string): number | undefined {
  const value = valueFor(flag);
  return value === undefined ? undefined : normalizeLaneNumber(value);
}

function required(flag: string): string {
  const value = normalizeOptionalText(valueFor(flag), 4096);
  if (!value) throw new Error(`${flag} requires a non-empty value.`);
  return value;
}

function help(): void {
  console.log(`Usage:
  manage-lanes.ts --list [--json]
  manage-lanes.ts --path
  manage-lanes.ts --assign-current N [--title title] [--cwd path] [--label label]
  manage-lanes.ts --assign N --task-id id --title title --cwd path [--label label]
  manage-lanes.ts --set N [--label label|--clear-label] [--cue text|--clear-cue]
                         [--provider provider --voice voice-id|--inherit-voice]
  manage-lanes.ts --activate N
  manage-lanes.ts --clear N

Lane changes are written atomically to:
  ${defaultLaneConfigurationPath()}`);
}

function summarize(lanes: VoiceLane[], activeLane?: number): void {
  for (let number = 1; number <= 9; number += 1) {
    const lane = lanes.find((candidate) => candidate.number === number);
    const active = number === activeLane ? "*" : " ";
    if (!lane) {
      console.log(`${active} ${number}  Unassigned`);
      continue;
    }
    const voice = lane.voiceOverride
      ? `${lane.voiceOverride.provider}/${lane.voiceOverride.voiceID}`
      : "Inherited voice";
    console.log(`${active} ${number}  ${displayName(lane)}  ·  ${voice}  ·  ${lane.task.id}`);
  }
}

if (has("--help") || args.length === 0) {
  help();
  process.exit(0);
}

if (process.platform !== "darwin") {
  console.error("SpeakEasy lane management is available only on macOS.");
  process.exit(1);
}

try {
  const path = defaultLaneConfigurationPath();
  if (has("--path")) {
    console.log(path);
    process.exit(0);
  }

  const configuration = await readLaneConfiguration(path);
  if (has("--list")) {
    if (has("--json")) console.log(JSON.stringify(configuration, null, 2));
    else summarize(configuration.lanes, configuration.activeLane);
    process.exit(0);
  }

  const assignCurrent = laneFor("--assign-current");
  const assign = laneFor("--assign");
  const set = laneFor("--set");
  const activate = laneFor("--activate");
  const clear = laneFor("--clear");
  const operations = [assignCurrent, assign, set, activate, clear].filter((value) => value !== undefined);
  if (operations.length !== 1) throw new Error("Choose exactly one lane operation.");

  if (assignCurrent !== undefined || assign !== undefined) {
    const number = assignCurrent ?? assign!;
    const existing = configuration.lanes.find((lane) => lane.number === number);
    const taskID = assignCurrent !== undefined
      ? normalizeOptionalText(valueFor("--task-id") ?? process.env.CODEX_THREAD_ID, 256)
      : normalizeOptionalText(valueFor("--task-id"), 256);
    if (!taskID) {
      throw new Error("No Codex task id is available. Pass --task-id explicitly.");
    }
    const title = normalizeOptionalText(valueFor("--title") ?? process.env.CODEX_THREAD_TITLE, 512)
      ?? `Codex task ${taskID.slice(0, 8)}`;
    const cwd = resolve(valueFor("--cwd") ?? process.cwd());
    const label = has("--clear-label")
      ? undefined
      : normalizeOptionalText(valueFor("--label"), 80) ?? existing?.label;
    const lane: VoiceLane = {
      number,
      label,
      task: { id: taskID, title, cwd },
      voiceOverride: existing?.voiceOverride,
      narrationCue: existing?.narrationCue,
      playbackRate: existing?.playbackRate,
    };
    configuration.lanes = configuration.lanes.filter((candidate) => candidate.number !== number);
    configuration.lanes.push(lane);
    configuration.lanes.sort((left, right) => left.number - right.number);
    configuration.activeLane = number;
    await writeLaneConfiguration(configuration, path);
    console.log(`Assigned Lane ${number} to ${displayName(lane)}.`);
    process.exit(0);
  }

  if (set !== undefined) {
    const lane = configuration.lanes.find((candidate) => candidate.number === set);
    if (!lane) throw new Error(`Lane ${set} is not assigned.`);
    if (has("--clear-label")) lane.label = undefined;
    else if (valueFor("--label") !== undefined) lane.label = normalizeOptionalText(valueFor("--label"), 80);
    if (has("--clear-cue")) lane.narrationCue = undefined;
    else if (valueFor("--cue") !== undefined) lane.narrationCue = normalizeOptionalText(valueFor("--cue"), 240);
    if (has("--inherit-voice")) lane.voiceOverride = undefined;
    else if (valueFor("--provider") !== undefined || valueFor("--voice") !== undefined) {
      const provider = required("--provider").toLowerCase();
      const voiceID = required("--voice");
      lane.voiceOverride = { provider, voiceID };
    }
    await writeLaneConfiguration(configuration, path);
    console.log(`Updated Lane ${set}: ${displayName(lane)}.`);
    process.exit(0);
  }

  if (activate !== undefined) {
    if (!configuration.lanes.some((lane) => lane.number === activate)) {
      throw new Error(`Lane ${activate} is not assigned.`);
    }
    configuration.activeLane = activate;
    await writeLaneConfiguration(configuration, path);
    console.log(`Lane ${activate} will be active the next time SpeakEasy loads lane configuration.`);
    process.exit(0);
  }

  if (clear !== undefined) {
    const previousCount = configuration.lanes.length;
    configuration.lanes = configuration.lanes.filter((lane) => lane.number !== clear);
    if (configuration.lanes.length === previousCount) throw new Error(`Lane ${clear} is already unassigned.`);
    if (configuration.activeLane === clear) configuration.activeLane = undefined;
    await writeLaneConfiguration(configuration, path);
    console.log(`Cleared Lane ${clear}.`);
    process.exit(0);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
