# FocusBar Status and Responsive Layout Design

Date: 2026-05-06  
Status: Approved for planning  
Scope: Desktop app UI behavior, tray visibility behavior, and window sizing constraints.

## Context

FocusBar currently has inconsistent status visibility and layout issues when the window size changes:

- Important values are not reliably visible in the app top area.
- Some labels are clipped or visually misaligned in smaller sizes.
- Tray text visibility behavior needs clear user control.

The user approved a direction where:

1. Top status prioritizes the currently selected mode.
2. Workday status remains visible as secondary context.
3. Responsive behavior uses one-line truncation with tooltip instead of wrapping.
4. Window remains resizable, constrained to a defined min/max size range.

## Goals

- Keep key timing information visible and stable in the app header area.
- Prevent word clipping and layout breakage while resizing.
- Provide clear tray behavior choice: always visible title vs hover-only tooltip.
- Preserve continuous workday tracking in background across mode switches.

## Non-Goals

- Redesigning overall visual theme, colors, or component system.
- Introducing new timer modes beyond existing workday, pomodoro, and stopwatch.
- Native platform-specific custom tray rendering beyond Tauri-provided behavior.

## UX Decisions

### 1) Top Status Composition

Use a single composed status line at the top:

- Primary segment: current mode state (workday, pomodoro, or stopwatch).
- Secondary segment: workday progress summary as background context.

Example format:

`Pomodoro Foco 12:31 • Jornada 42% (falta 04:18)`

Behavior:

- Always one line.
- Truncates with ellipsis when space is insufficient.
- Full text available via native tooltip (`title`).

### 2) Responsive Strategy

When window shrinks:

- Keep one-line text.
- Do not wrap to multiple lines.
- Do not increase card density aggressively.
- Truncate low-priority text first within composed status.

When window expands:

- Same structure, more readable due to available width.
- No mode-dependent layout jumps.

### 3) Window Sizing Rules

User-approved bounds:

- Minimum: `380 x 560`
- Maximum: `560 x 900`

Window remains resizable within these limits.

### 4) Tray Visibility Mode

Keep tray information behavior configurable:

- `always visible`: show tray title text persistently (macOS title area).
- `hover only`: hide persistent title and show data only in tooltip.

App setting controls this behavior and persists locally.

## Functional Behavior

### Workday Continuity

- Workday timer continues in background regardless of selected UI mode.
- Only lunch state reduces workday accumulation.
- Switching to pomodoro/stopwatch must not pause workday progression.

### Mode Priority in Status

- If current mode is pomodoro/stopwatch, that mode is shown as primary.
- Workday remains secondary if a workday is active.
- If no workday has started, secondary segment is omitted or replaced with neutral text.

### Stopwatch Countdown (existing approved requirement)

- Stopwatch supports retroactive elapsed setup.
- Stopwatch supports target remaining setup.
- Remaining display never goes negative.

## Error Handling and Edge Cases

- No active workday: show neutral secondary text (`Sem jornada ativa` or omit).
- Workday complete: secondary segment switches to completion message.
- Pomodoro phase transition: primary text updates seamlessly.
- Very narrow width near min bound: composed line truncates gracefully with tooltip fallback.
- Tray API failures outside Tauri context are ignored safely in frontend.

## Implementation Outline (Design-Level)

1. **Tauri config**
   - Apply min/max window constraints.
   - Keep window resizable.
2. **Header status UI**
   - Use one composed text source with primary/secondary semantics.
   - Apply CSS truncation + title tooltip.
3. **Responsive CSS**
   - Enforce one-line status behavior.
   - Ensure footer and controls do not overlap or clip.
4. **Tray behavior**
   - Keep update command accepting `always_visible`.
   - Persist user preference and apply on each update cycle.
5. **Timer semantics**
   - Preserve existing background workday updates independent of selected mode.

## Test Plan (Acceptance)

1. Start workday, switch across all modes, verify workday continues.
2. Resize window from max down to min and verify:
   - no broken alignment,
   - no multi-line status wrapping,
   - truncation appears with ellipsis.
3. Hover truncated top status and verify full tooltip text.
4. Toggle tray visibility mode:
   - always visible shows persistent title,
   - hover-only removes persistent title and keeps tooltip.
5. Validate icon remains visible in tray.
6. Validate stopwatch retroactive + countdown behavior with zero-floor remaining.

## Risks and Mitigations

- **Risk:** macOS tray title rendering differences by OS/theme.
  - **Mitigation:** keep tooltip as canonical fallback.
- **Risk:** long localized strings overflow.
  - **Mitigation:** single-line truncation and concise label copy.
- **Risk:** resize handling causes layout shift in controls.
  - **Mitigation:** keep fixed hierarchy and stable spacing tokens.

## Open Questions

None for current scope. Requirements are explicit and approved.
