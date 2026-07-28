export const RELEASE = {
  appDmg: {
    version: "0.2.17",
    label: "Signed DMG",
    url: "https://github.com/arach/SpeakEasy/releases/latest",
  },
  npmLatest: { version: "0.2.16" },
  player: { state: "released", in: "0.2.17" },
  listening: {
    state: "preview",
    note: "Merged to master after the 0.2.17 release cut",
  },
  lanes: {
    state: "preview",
    note: "Merged to master after the 0.2.17 release cut",
  },
  micPicker: {
    state: "preview",
    note: "Merged to master after the 0.2.17 release cut",
  },
} as const

