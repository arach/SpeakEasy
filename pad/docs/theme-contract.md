# Deck Theme Contract v1

A **deck theme** is a Chrome-extension-style manifest that reskins the Deck control surface. Themes can adjust design tokens (`colors`), add arbitrary `css`, and provide full `html` chrome. As long as a theme plays by this contract, every interaction — push-to-talk, lane selection, commands, sheets, demo audio — keeps working unchanged.

Themes pin the contract with `pad_theme.contract: 1`. Additions within v1 are backward-compatible.

## Manifest

```json
{
  "manifest_version": 1,
  "name": "Night Ops",
  "version": "1.0.0",
  "author": "you",
  "description": "Low-glare deck for night sessions",
  "pad_theme": {
    "contract": 1,
    "scheme": "dark",
    "colors": { "signal": "#74f2ce", "ink": "#e8f0ee", "void": "#071013" },
    "css": "/* any CSS */",
    "html": "<div class=\"shell\"><div data-pad-slot=\"topbar\"></div></div>"
  }
}
```

- `manifest_version` must be `1`; `name` is required (≤ 60 chars). `version` defaults to `"1.0.0"`. `author` / `description` are optional.
- Colors accept hex (`#rgb` / `#rrggbb` / `#rrggbbaa`), `rgb()`/`rgba()`, or Chrome-style `[r, g, b]` arrays.
- `scheme` (`"dark"` | `"light"`) selects the shared light-chrome treatment; when omitted it is derived from the luminance of `void`.
- `css` and `html` are each capped at 64 KB.

### Color tokens

| Manifest key    | CSS custom property | Derived when omitted                    |
| --------------- | ------------------- | --------------------------------------- |
| `signal`        | `--signal`          | — (also derives `--signal-rgb`)         |
| `warning`       | `--warning`         | —                                       |
| `danger`        | `--danger`          | —                                       |
| `ink`           | `--ink`             | — (also derives `--ink-rgb`)            |
| `ink_2`         | `--ink-2`           | `ink` → `void` 38% (when both set)      |
| `ink_3`         | `--ink-3`           | `ink` → `void` 60% (when both set)      |
| `void`          | `--void`            | —                                       |
| `page`          | `--page`            | `void` darkened 30%                     |
| `plate`         | `--plate`           | `void` + 5% `ink`                       |
| `plate_2`       | `--plate-2`         | `void` + 10% `ink`                      |
| `rule`          | `--rule`            | `ink` at 12% alpha                      |
| `rule_strong`   | `--rule-strong`     | `ink` at 23% alpha                      |

Unset tokens fall back to the built-in Flight values. The app injects them as `:root[data-theme="<id>"] { … }` followed by the theme's verbatim `css`, so theme CSS can target `.pad[data-theme="<id>"] …` or anything else.

## Root state attributes

The app owns these on `<main class="pad">` and updates them on every render. Themes read them as styling hooks and must never set them:

- `data-theme`, `data-scheme`, `data-contract`
- `data-mode` — `console | cluster | deck | checklist | pfd | micro`
- `data-phase` — `unlocked | validatingLock | cueing | ready | warmingUp | recording | transcribing | submitting | preparingSpeech | speaking | failed`
- `data-tone` — `idle | live | work | speak | alarm` (rolled-up phase severity)
- `data-link` — `connecting | healthy | suspect | degraded | offline`
- `data-notice` — `info | error`
- `data-pressed`, `data-cancel` — `true | false` push-to-talk states

## Slots

Theme `html` is mounted inside `<main class="pad">`. Elements tagged with a slot attribute receive the matching app region (the slot element is *replaced* by the region markup):

- `data-pad-slot="topbar"` — brand, layout/theme button, install, link chip
- `data-pad-slot="surface"` — the active layout's control surface
- `data-pad-slot="status"` — the bottom status rail
- `data-pad-slot="sheets"` — modal sheets (keep present; they render `position: fixed`)

Any region without a matching slot is appended to a default flex-column container after the chrome, so purely decorative HTML still yields a working deck. Use each slot at most once.

## Interaction attributes

The app binds behavior by selector after every render. A theme may place elements with these attributes anywhere in its chrome (typically inside custom markup around the surface slot); the app manages their state (`disabled`, `aria-pressed`, `data-active`, busy markers).

- `button[data-ptt]` — push-to-talk. Pointer-down starts, release sends, dragging more than 24 px outside arms cancel, ESC / window blur aborts. `SPACE` / `ENTER` are keyboard equivalents. The app owns the button's label and hint text; style the states via root `[data-pressed="true"]` / `[data-cancel="true"]`.
- `button[data-lane="<1-9>"]` — activate lane N. The app sets `data-active`, `data-empty`, `aria-pressed`, `disabled`.
- `button[data-command="<method>"]` — send a command. Methods: `system.ping`, `listening.cancel`, `playback.replay`, `playback.toggle`, `lane.announce`, `task.revealOnMac`. While awaiting the Mac's ack the button is disabled and may contain a `.button-pending` marker.
- The remaining protocol methods are sent by the app itself and are not theme-bindable: `state.snapshot`, `system.hello`, `lane.activate` (via `data-lane`), `lane.activateAndListen` and `listening.toggle` (via push-to-talk), `playback.stop` (push-to-talk while narrating).
- Sheet controls: `button[data-appearance]`, `button[data-install]`, `button[data-connection]` open sheets; `[data-dismiss-sheet]`, `[data-select-mode="<mode>"]`, `[data-select-theme="<id>"]`, `[data-install-now]` are used inside sheet markup.
- Demo audio: `input[type="range"][data-demo-volume]` (0–100) adjusts local demo narration volume; `[data-demo-volume-value]` is its readout.

## Lifecycle guarantees

- Region contents are re-rendered from application state (full innerHTML replacement) on every state change, often several times per second during audio playback. Theme chrome outside the slots persists; region contents do not. Themes must style and position — never mutate region DOM.
- Theme `html` is sanitized at load: `script`, `iframe`, `object`, `embed`, `form`, `link`, `meta`, `base` tags, inline `on*` handlers, `srcdoc`, and `javascript:` / `data:` / `vbscript:` URLs are stripped. There is no scripting in themes.
- Theme `css` is injected verbatim and is not sanitized — it is presentation-only and only ever installed by the device owner.
- The Micro Deck and Glass PFD layouts keep their own hardcoded device palettes; theme CSS may still override them explicitly.
