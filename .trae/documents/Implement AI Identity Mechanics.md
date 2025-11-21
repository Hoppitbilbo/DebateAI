## Desired Flow
- Teacher selects two distinct characters
- Student chats with Personaggio A and Personaggio B without seeing real names
- Identification mechanics vary by difficulty: Easy (know the two names, assign to left/right), Medium (see 4 names: 2 correct, 2 incorrect, assign), Hard (type both names without suggestions)
- Reflect and receive feedback with correctness summary

## Current Behavior
- Character setup and validation from search: `src/pages/AiIdentityPage.tsx:38-47`
- Names hidden in chat via Personaggio A/B; identity non‑reveal enforced: `src/components/AiIdentityChat.tsx:104-108`, `121-127`
- Easy goes to identification phase; selection via buttons (not drag‑and‑drop): `src/components/AiIdentityChat.tsx:193-198`, `350-367`; identification component: `src/components/AiIdentity/AiIdentityIdentificationPhase.tsx:136-177`, submit: `36-50`
- Medium shows “possible names” chips only; no identification step: `src/components/AiIdentityChat.tsx:493-503`, `544-553`
- Hard requires manual text guesses in reflection: `src/components/AiIdentityChat.tsx:378-404`; correctness appended in feedback for easy/hard: `264-269`
- No drag‑and‑drop library in dependencies

## Gaps
- Easy: missing drag‑and‑drop to assign the two known names to left/right chats
- Medium: missing identification step with 4 draggable names (2 correct, 2 incorrect)
- Feedback: medium guesses not included in correctness summary

## Implementation Plan
### 1) Difficulty‑specific identification UI
- Easy: replace/selectable identification with drag‑and‑drop of two name chips into A/B drop zones; keep button selection as fallback for accessibility
- Medium: introduce identification phase with four draggable name chips (two real names + two plausible incorrect); student assigns each to A/B; prevent duplicates; validate before continue
- Hard: keep manual text inputs; ensure submission requires both guesses

### 2) Phase control
- Update `handleEndActivity` to route medium to `"identification"` like easy: `src/components/AiIdentityChat.tsx:187-198`
- Pass callbacks to identification to advance to reflection and store guesses: `src/components/AiIdentityChat.tsx:200-205`

### 3) Name options generation (medium)
- Use existing `generateConfusingNames(...)` to source incorrect names: `src/components/AiIdentityChat.tsx:76-102`
- Build a 4‑name pool: `{character1.name, character2.name}` + two incorrect from the confusing lists, deduped

### 4) Drag‑and‑drop
- Add `@dnd-kit/core` for React drag‑and‑drop
- Implement `DraggableName` chips and `DropZoneA/B` areas with visual feedback and keyboard support
- Persist assignments in identification component state; validate on submit

### 5) Evaluation and feedback
- Record guesses for easy/medium; include correctness summary in feedback along with reflection: extend logic at `src/components/AiIdentityChat.tsx:264-269` to include medium

### 6) i18n updates
- Add strings for drag instructions, drop zone labels, and error messages (e.g., “Drag each name to Personaggio A/B”, “Both assignments required”) across locales (`en`, `fr`, `es`, `de`, `it`)

### 7) QA and tests
- Unit tests for identification validation (easy/medium) and correctness calculation
- Manual QA: ensure names never appear in chat, only in identification UI; verify medium shows exactly two incorrect options

### 8) Accessibility and UX
- Keep button‑based selection as accessible fallback
- Focus management and ARIA labels for drag‑and‑drop components

## Deliverables
- Updated `AiIdentityChat` phase routing and feedback logic
- New or updated identification component(s) supporting drag‑and‑drop for easy/medium
- i18n entries and locale updates
- Tests for validation and correctness

## Confirmation
- If this plan matches your intended flow, I will implement the drag‑and‑drop identification for Easy and Medium, adjust phase routing, and include correctness in feedback for Medium.