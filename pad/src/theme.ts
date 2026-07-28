export const PAD_THEME_IDS = ["flight", "ceramic", "amber"] as const;

export type PadTheme = (typeof PAD_THEME_IDS)[number];

export const PAD_THEME_LABELS: Record<PadTheme, string> = {
  flight: "Flight",
  ceramic: "Ceramic",
  amber: "Amber",
};

const PAD_THEME_KEY = "speakeasy.pad.theme.v1";

export function normalizePadTheme(value: string | null | undefined): PadTheme {
  return PAD_THEME_IDS.includes(value as PadTheme) ? value as PadTheme : "flight";
}

export function nextPadTheme(theme: PadTheme): PadTheme {
  const index = PAD_THEME_IDS.indexOf(theme);
  return PAD_THEME_IDS[(index + 1) % PAD_THEME_IDS.length]!;
}

export function readPadTheme(storage: Pick<Storage, "getItem"> = localStorage): PadTheme {
  try {
    return normalizePadTheme(storage.getItem(PAD_THEME_KEY));
  } catch {
    return "flight";
  }
}

export function savePadTheme(theme: PadTheme, storage: Pick<Storage, "setItem"> = localStorage): void {
  try {
    storage.setItem(PAD_THEME_KEY, theme);
  } catch {
    // A theme is presentation-only; private browsing storage failures should
    // never interrupt the command channel.
  }
}

export function applyPadTheme(theme: PadTheme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
}
