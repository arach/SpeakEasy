export const PAD_MODE_IDS = ["console", "cluster", "deck", "checklist", "pfd", "micro"] as const;

export type PadMode = (typeof PAD_MODE_IDS)[number];

export const PAD_MODE_COPY: Record<PadMode, { label: string; description: string }> = {
  console: { label: "Console", description: "Lane bank and mission controls together" },
  cluster: { label: "Cluster", description: "One focal instrument with thumb lanes" },
  deck: { label: "Flight Deck", description: "Nine tactile channel strips" },
  checklist: { label: "Checklist", description: "Dense, auditable operations view" },
  pfd: { label: "Glass PFD", description: "Live center field with flanking tapes" },
  micro: { label: "Micro Deck", description: "Translucent hardware control surface" },
};

const PAD_MODE_KEY = "speakeasy.pad.mode.v1";

export function normalizePadMode(value: string | null | undefined): PadMode {
  return PAD_MODE_IDS.includes(value as PadMode) ? value as PadMode : "console";
}

export function readPadMode(storage: Pick<Storage, "getItem"> = localStorage): PadMode {
  try {
    return normalizePadMode(storage.getItem(PAD_MODE_KEY));
  } catch {
    return "console";
  }
}

export function savePadMode(mode: PadMode, storage: Pick<Storage, "setItem"> = localStorage): void {
  try {
    storage.setItem(PAD_MODE_KEY, mode);
  } catch {
    // Layout is presentation-only. Storage failures must not affect control.
  }
}

export function applyPadMode(mode: PadMode, root: HTMLElement = document.documentElement): void {
  root.dataset.mode = mode;
}
