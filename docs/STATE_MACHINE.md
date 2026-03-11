# SunVantage App — State Machine Documentation

This document describes all authentication, onboarding, witness, streak, reflection, photo, and global-count states and transitions. No code—structure and logic only.

---

## 1. High-Level State Diagram

```
                    ┌─────────────────┐
                    │   LOAD (/)      │
                    │   Welcome       │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
   [Not signed in]    [Signed in,         [Signed in,
   Sub: See the day   streak = 0]         streak ≥ 1]
   CTA: Begin today   Sub: A quiet...    Sub: Make space...
                     CTA: Start ritual   CTA: Step outside
         │                   │                   │
         │    (tap CTA)      │                   │
         ▼                   ▼                   ▼
                    ┌─────────────────┐
                    │   AUTH           │
                    │   Sign In / Up   │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │ signUp success               │ signIn success
              ▼                              ▼
     ┌─────────────────┐            ┌─────────────────┐
     │  ONBOARDING      │            │  WITNESS        │
     │  Profile details │            │  /sunrise       │
     └────────┬────────┘            └────────┬────────┘
              │ submit                        │
              ▼                              │
     ┌─────────────────┐                     │
     │  WITNESS         │◄───────────────────┘
     │  /sunrise        │
     └────────┬────────┘
              │
    ┌─────────┴─────────┐
    │ hasLogged = false│     │ hasLogged = true │
    │ Pre-witness      │     │ Post-witness     │
    │ (ritual CTA)     │────►│ (photo, reflect,  │
    │                  │ tap │  global count)    │
    └──────────────────┘     └──────────────────┘
```

---

## 2. Authentication States

### 2.1 Load (Welcome) Screen — `/`

| State   | Trigger condition              | Subheading                         | CTA             | Button enabled |
|--------|--------------------------------|------------------------------------|-----------------|----------------|
| Blank  | `user == null`                 | "See the day differently."         | "Begin today"   | Yes            |
| New    | `user != null` and `streak == 0` | "A quiet place to begin."          | "Start the ritual" | Yes         |
| Returning | `user != null` and `streak >= 1` | "Make space for the first light." | "Step outside" | Yes            |

**UI shown (all states):**
- Centered: App title "SunVantage"
- Centered: Subheading (from table)
- Centered: Single CTA button (from table)
- Background: Gradient (top navy, horizon glow)
- No streak, no extra copy

**Transitions:**
- Tap CTA → Navigate to `/auth` (same for all three states)

---

### 2.2 Auth Screen — `/auth`

| State    | Trigger condition | Title                | Subtitle copy |
|----------|-------------------|----------------------|---------------|
| Sign In  | `mode === 'signIn'`  | "Welcome back"       | "Sign in to catch today's sunrise with intention." |
| Sign Up  | `mode === 'signUp'`  | "Create your account" | "Sign up to start a gentle sunrise ritual." |

**UI shown:**
- Header: "SunVantage", tagline "See the day differently."
- Card: Title, subtitle, email input, password input
- Primary button: "Sign in" or "Sign up"
- Secondary link: "New here? Create an account" / "Already have an account? Sign in"
- Error text (if any), message text (if any)

**Button conditions:**
- Primary (Sign in / Sign up): **Disabled** when `loading === true`; otherwise enabled.
- Toggle link: Always enabled.

**Transitions:**
- Session exists on mount → `router.replace('/sunrise')` (leave auth).
- Sign up success → `router.replace('/onboarding')`.
- Sign in success → `router.replace('/sunrise')`.
- Toggle link → Switch between Sign In and Sign Up (no route change).
- Validation: Empty email or password → show error, no transition.

---

### 2.3 Onboarding Screen — `/onboarding`

| State     | Trigger condition | Title          | Subtitle copy |
|-----------|-------------------|----------------|---------------|
| Profile   | (single state)    | "A few details" | "We'll use these to gently personalise your sunrise moments." |

**UI shown:**
- Header: "SunVantage", tagline "See the day differently."
- Card: Title, subtitle, First name input, City input
- Primary button: "Continue"
- Error text (if any)

**Button conditions:**
- "Continue": **Disabled** when `loading === true`; otherwise enabled.
- No validation that disables the button; invalid submit shows error.

**Transitions:**
- Submit with both first name and city non-empty → Upsert profile → `router.replace('/sunrise')`.
- Missing name or city → set error, stay on onboarding.
- Auth/session error → set error "Unable to find your account. Please sign in again.", stay.

---

## 3. Witness (Sunrise) Screen — `/sunrise`

### 3.1 Screen-Level States

| State         | Trigger condition                    | What user sees (summary) |
|---------------|--------------------------------------|---------------------------|
| Initial load  | `initialLoading === true`            | Centered activity indicator only |
| Pre-witness   | `!initialLoading && !hasLogged`      | Ritual CTA, horizon line, "Witness today's sunrise", helper text |
| Post-witness  | `!initialLoading && hasLogged`       | "✓ Sunrise witnessed", photo block (or Add photo), reflection block, global count (if any) |

---

### 3.2 Pre-Witness State (Not Logged Today)

**Trigger:** `hasLogged === false` and `initialLoading === false`.

**UI components:**
- Header: "SunVantage", tagline from `getWitnessSubheading(currentStreak)` (see Streak display logic).
- Streak block (if `!initialLoading`): See § 4.
- Centered invitation: "The light is waiting."
- Ritual touchable: Horizon line (animated opacity on press), CTA text "Witness today's sunrise", chevron, animated underline.
- Helper text: "Tap once you've stepped outside."
- Footer: "Back to welcome", "Sign out".

**Button / CTA conditions:**
- Ritual CTA: **Disabled** when `logging === true`; otherwise enabled.
- On press: Horizon glow + scale animation, then after 750 ms call log API; on success set `hasLogged = true` and transition to post-witness.

**Transitions:**
- Tap ritual CTA → `logging = true` → API insert today's sunrise log → `hasLogged = true`, `logging = false` → Post-witness UI.
- Back to welcome → `router.replace('/')`.
- Sign out → Auth sign out, then `router.replace('/')`.

---

### 3.3 Post-Witness State (Logged Today)

**Trigger:** `hasLogged === true`.

**UI components:**
- Same header and streak block as above.
- Inactive horizon line + "✓ Sunrise witnessed" (no tappable ritual).
- Subtext: "You showed up. That's enough."
- Photo section (see § 6).
- Reflection block (see § 5).
- Error line (if `error` set).
- Global count line (see § 7).
- Footer: "Back to welcome", "Sign out".

**Transitions:**
- None that leave "post-witness" on this screen; user stays until they navigate away or sign out.

---

## 4. Streak Display Logic (Witness Screen Only)

**Visibility:** Streak block is shown only when `!initialLoading`. It is **not** shown on the load (welcome) screen.

**Conditional copy:**

| Condition | What is shown |
|-----------|----------------|
| `currentStreak > 0` | "🔥 X Morning Streak(s)" (X = currentStreak), then `streakMessage.primary`, then `streakMessage.secondary` if present. |
| `longestStreak > 0` and `currentStreak === 0` | "Ready to begin again?" and "Longest streak: X morning(s)." |
| `currentStreak === 0` and `longestStreak === 0` | "Start here." (single line). |

**Streak message table** (`getStreakMessage(currentStreak, longestStreak)`):

| currentStreak | longestStreak | primary               | secondary                    |
|---------------|---------------|------------------------|------------------------------|
| 1             | 1             | "You've begun."        | "Every ritual begins somewhere." |
| 2–5           | = current     | "You're building something steady." | "X mornings in a row."   |
| > 5           | = current     | "You've been showing up." | "X consecutive mornings." |
| 1             | > 1           | "Welcome back."        | "It's always here."          |
| (other)       | —             | "🔥 X day streak"      | "Longest: Y"                 |

---

## 5. Reflection Input States

**Visibility:** Reflection block is shown only when `hasLogged === true`.

### 5.1 Reflection Block Contents

- Invitation line: From `getReflectionInvitation()` — alternates by day between "What stayed with you?" and "What small thing deserves appreciation?"
- Multiline text input (placeholder: "A word, a sentence, or just how it felt.").
- "Keep this note" control (opacity animated from reflection validity).
- One of:
  - "Saved. Just between you." (when `reflectionAck === true`),
  - "Saving…" (when `savingReflection === true`),
  - "This is optional. It stays just between you and this moment." (default).
- When keyboard visible: "Tap outside to dismiss keyboard".

### 5.2 Validation Rule

- **Valid input:** After trim, remove all whitespace; length ≥ 2 characters.
- **Invalid:** Empty, whitespace-only, or &lt; 2 visible characters.

### 5.3 Button and Persistence Logic

| Condition                    | "Keep this note" button | On tap / save behaviour |
|-----------------------------|--------------------------|---------------------------|
| Invalid input               | Disabled, reduced opacity | No action.               |
| Valid input                 | Enabled, full opacity    | Persist to DB, show "Saved. Just between you." |
| `savingReflection === true` | Disabled                 | No action.                |

- **Submit (tap):** If invalid, do nothing. If valid, persist and set `reflectionAck = true`.
- **Blur / debounced save:** Only persist when input is valid; no "Saved" shown for background save.
- **No persistence** and **no "Saved"** for invalid input (empty or &lt; 2 visible chars).

### 5.4 Transitions

- Typing → debounced background save when valid (no ack).
- Tap "Keep this note" with valid input → `savingReflection = true` → persist → `reflectionAck = true`, `savingReflection = false`.
- Input becomes invalid → button disabled; no new save or ack.

---

## 6. Photo Upload States

**Visibility:** Photo section is shown only when `hasLogged === true`.

### 6.1 States

| State        | Trigger condition                          | UI shown |
|-------------|---------------------------------------------|----------|
| No photo    | `hasLogged && !photoUrl` (or URL too short) | "Add photo" button only. |
| Photo shown | `hasLogged && photoUrl` (string, length > 10) | Image, and optionally "Replace photo" link. |
| Replaced    | `hasLogged && hasReplacedPhoto === true`    | Image only; no "Replace photo" (one replace per day). |

### 6.2 Button Conditions

| Control        | Disabled when           | Copy / behaviour |
|----------------|-------------------------|-------------------|
| "Add photo"    | `uploadingPhoto === true` | "Add photo" or spinner. |
| "Replace photo"| `uploadingPhoto === true` or `hasReplacedPhoto === true` | "Replace photo" or "Replacing…". |

### 6.3 Transitions

- Tap "Add photo" or "Replace photo" → permission request → picker → upload → update `photoUrl` / `photoMessage`; on replace set `hasReplacedPhoto = true`.
- If already replaced once today, replace control is hidden; no further transition.

---

## 7. Global Count Rendering Logic

**Visibility:** Global count line is shown only when **`hasLogged === true`** and **`globalCount !== null`**.

**Copy (all when `hasLogged`):**

| Condition              | Copy |
|-------------------------|------|
| `globalCount === 0`     | "Be the first to welcome the day with SunVantage today." |
| `globalCount === 1`     | "You are the first to welcome the day with SunVantage today!" |
| `globalCount >= 2`      | "X people have welcomed the day with SunVantage today." (X = globalCount) |

**Note:** Branches for `!hasLogged` (e.g. "Be the second…", "Be the third…") are never shown because the block is gated by `hasLogged`.

---

## 8. Summary Tables

### 8.1 Load Screen — State vs Copy

| User   | Streak | Subheading                         | CTA               |
|--------|--------|------------------------------------|-------------------|
| null   | —      | See the day differently.           | Begin today       |
| set    | 0      | A quiet place to begin.           | Start the ritual  |
| set    | ≥ 1    | Make space for the first light.   | Step outside     |

### 8.2 Witness Screen — Subheading (Header Tagline)

| Streak | Subheading                         |
|--------|------------------------------------|
| 0      | A quiet place to begin.           |
| ≥ 1    | Make space for the first light.   |

"See the day differently." is **never** used on the witness screen (load-only).

### 8.3 Witness Screen — Main CTA / Content by hasLogged

| hasLogged | Main content                          | Primary action          |
|-----------|----------------------------------------|--------------------------|
| false     | Horizon line + "Witness today's sunrise" | Tap to log today        |
| true      | "✓ Sunrise witnessed" + photo + reflection | Add photo, keep note   |

### 8.4 Reflection — "Keep this note" and Save

| Input valid? | savingReflection | Button      | Persist on tap | Show "Saved" |
|--------------|------------------|------------|----------------|--------------|
| No           | any              | Disabled   | No             | No           |
| Yes          | false            | Enabled    | Yes            | Yes (on tap) |
| Yes          | true             | Disabled   | —              | No           |

---

## 9. Transition Rules (Concise)

- **Load → Auth:** Tap CTA (any of the three load states).
- **Auth → Sunrise:** Sign in success.
- **Auth → Onboarding:** Sign up success.
- **Onboarding → Sunrise:** Submit profile with name + city.
- **Sunrise pre-witness → post-witness:** Tap ritual CTA, API success, `hasLogged = true`.
- **Sunrise → Load:** "Back to welcome" or sign out.
- **Reflection:** Valid input + tap "Keep this note" → persist → show "Saved. Just between you."
- **Photo:** Add or replace once per day when `hasLogged`; state advances by `photoUrl` and `hasReplacedPhoto`.

---

*End of state machine documentation.*
