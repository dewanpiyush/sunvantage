# SunVantage — Copy Logic Matrix

Every user-visible string with component, condition, exact copy, trigger, and persistence.

---

## 1. Welcome (Load) Screen — `/`

| Component   | Condition              | Exact copy                         | Trigger                    | Persistence |
|------------|------------------------|------------------------------------|----------------------------|-------------|
| App title  | Always                 | SunVantage                         | Screen render              | None        |
| Subheading | `user == null`         | See the day differently.           | Async: session + profile   | None        |
| Subheading | `user != null`, streak = 0 | A quiet place to begin.        | Async: session + profile   | None        |
| Subheading | `user != null`, streak ≥ 1 | Make space for the first light. | Async: session + profile   | None        |
| CTA button | `user == null`         | Begin today                        | Async: session + profile   | None        |
| CTA button | `user != null`, streak = 0 | Start the ritual               | Async: session + profile   | None        |
| CTA button | `user != null`, streak ≥ 1 | Step outside                   | Async: session + profile   | None        |

**Trigger:** On mount, `getSession()` then profile `current_streak`; `getRitualState(user, streak)` drives subheading + CTA.  
**Persistence:** All copy is in-memory; no user preference or DB for these strings.

---

## 2. Auth Screen — `/auth`

| Component     | Condition     | Exact copy                                           | Trigger        | Persistence |
|--------------|---------------|------------------------------------------------------|----------------|-------------|
| Tagline      | Always        | See the day differently.                             | Render         | None        |
| Card title   | `mode === 'signIn'`  | Welcome back                                  | Toggle / render | None       |
| Card title   | `mode === 'signUp'`  | Create your account                            | Toggle / render | None       |
| Subtitle     | Sign in       | Sign in to catch today's sunrise with intention.      | Render         | None        |
| Subtitle     | Sign up       | Sign up to start a gentle sunrise ritual.            | Render         | None        |
| Email label  | Always        | Email                                                | Render         | None        |
| Email placeholder | Always    | you@example.com                                     | Render         | None        |
| Password label | Always      | Password                                            | Render         | None        |
| Password placeholder | Always  | Minimum 6 characters                               | Render         | None        |
| Primary button | Sign in     | Sign in                                             | Render         | None        |
| Primary button | Sign up     | Sign up                                             | Render         | None        |
| Link         | Sign in       | New here? Create an account                          | Render         | None        |
| Link         | Sign up       | Already have an account? Sign in                     | Render         | None        |
| Error        | Validation    | Please enter email and password.                     | Submit empty   | None        |
| Error        | API / normalize | (normalizeError message, e.g. Incorrect email or password.) | Submit / API  | None        |
| Message      | Sign up success | Check your email to confirm your account.          | Sign up OK     | None        |

**Trigger:** Mode from state; error/message from submit and API response.  
**Persistence:** None; error/message cleared on mode toggle or next submit.

---

## 3. Onboarding Screen — `/onboarding`

| Component   | Condition | Exact copy                                                       | Trigger      | Persistence |
|------------|-----------|------------------------------------------------------------------|--------------|-------------|
| Tagline    | Always    | See the day differently.                                        | Render       | None        |
| Card title | Always    | A few details                                                    | Render       | None        |
| Subtitle   | Always    | We'll use these to gently personalise your sunrise moments.      | Render       | None        |
| Label      | Always    | First name                                                       | Render       | None        |
| Placeholder| Always    | Alex                                                             | Render       | None        |
| Label      | Always    | City                                                             | Render       | None        |
| Placeholder| Always    | Lisbon                                                           | Render       | None        |
| Button     | Always    | Continue                                                         | Render       | None        |
| Error      | Validation| Please enter both your first name and city.                       | Submit empty | None        |
| Error      | Auth      | Unable to find your account. Please sign in again.                | Session fail | None        |
| Error      | API       | We could not save your details. Please try again.                 | Upsert fail  | None        |
| Error      | Catch     | Something went wrong. Please try again.                           | Exception    | None        |

**Trigger:** Error set on submit (validation, session, API, catch).  
**Persistence:** None; first name and city sent to profile upsert only.

---

## 4. Witness (Sunrise) Screen — Header & Streak

| Component     | Condition                    | Exact copy                         | Trigger           | Persistence |
|--------------|-----------------------------|------------------------------------|-------------------|-------------|
| App title    | Always                      | SunVantage                         | Render            | None        |
| Tagline      | `currentStreak === 0`       | A quiet place to begin.            | getWitnessSubheading | None     |
| Tagline      | `currentStreak >= 1`        | Make space for the first light.    | getWitnessSubheading | None     |
| Streak count | `currentStreak > 0`         | 🔥 {X} Morning Streak(s)            | getStreakMessage  | From profile / RPC |
| Streak primary | (see getStreakMessage)    | (see table below)                  | getStreakMessage  | None        |
| Streak secondary | (see getStreakMessage)   | (see table below)                  | getStreakMessage  | None        |
| Header line  | `longestStreak > 0`, current = 0 | Ready to begin again?           | Render            | None        |
| Header sub   | Same                        | Longest streak: {X} morning(s).     | Render            | None        |
| Header line  | `currentStreak === 0`, longest = 0 | Start here.                    | Render            | None        |

**Streak message (primary / secondary) — witness only:**

| currentStreak | longestStreak | Primary                         | Secondary                    |
|---------------|---------------|---------------------------------|------------------------------|
| 1             | 1             | You've begun.                   | Every ritual begins somewhere. |
| 2–5           | = current     | You're building something steady. | {X} mornings in a row.     |
| > 5           | = current     | You've been showing up.         | {X} consecutive mornings.    |
| 1             | > 1           | Welcome back.                   | It's always here.             |
| (other)       | —             | 🔥 {X} day streak               | Longest: {Y}                  |

**Trigger:** Tagline on load + currentStreak; streak block when `!initialLoading`; copy from getStreakMessage.  
**Persistence:** Streak values from profile / RPC / log dates; copy not stored.

---

## 5. Witness Screen — Pre/Post Tap (Ritual & Confirmation)

| Component       | Condition        | Exact copy                  | Trigger              | Persistence |
|-----------------|------------------|-----------------------------|----------------------|-------------|
| Center invitation | `!hasLogged`   | The light is waiting.       | Render                | None        |
| Ritual CTA      | `!hasLogged`     | Witness today's sunrise    | Render                | None        |
| Post-witness line | `hasLogged`    | ✓ Sunrise witnessed        | After log API success | None       |
| Subtext         | `hasLogged`      | You showed up. That's enough. | Render              | None        |
| Subtext         | `!hasLogged`    | Tap once you've stepped outside. | Render           | None        |

**Trigger:** hasLogged from today-log fetch and from successful witness tap.  
**Persistence:** hasLogged derived from DB (today log exists); strings not stored.

---

## 6. Witness Screen — Photo

| Component   | Condition              | Exact copy                    | Trigger          | Persistence |
|------------|------------------------|------------------------------|------------------|-------------|
| Add photo  | `hasLogged`, no photo  | Add photo                    | Render           | None        |
| Replace link | `hasLogged`, has photo, !hasReplacedPhoto | Replace photo   | Render       | None        |
| Replace link | Uploading              | Replacing…                   | uploadingPhoto   | None        |
| Photo message | After upload success | Your morning is now part of something larger. | setPhotoMessage | Session only |
| Photo message | After replace success | Photo updated. Your morning is still part of something larger. | setPhotoMessage | Session only |

**Trigger:** Add/Replace tap → picker → upload → setPhotoMessage or setError.  
**Persistence:** Photo URL and replace flag in DB; message strings in component state only.

---

## 7. Witness Screen — Reflection

| Component     | Condition           | Exact copy                                           | Trigger              | Persistence |
|---------------|---------------------|------------------------------------------------------|----------------------|-------------|
| Invitation    | Day-based           | What stayed with you?                                | getReflectionInvitation (day seed) | None   |
| Invitation    | Day-based           | What small thing deserves appreciation?              | getReflectionInvitation (day seed) | None   |
| Input placeholder | Always            | A word, a sentence, or just how it felt.              | Render                | None        |
| Submit button | Always              | Keep this note                                       | Render                | None        |
| Saved confirmation | `reflectionAck`   | Saved. Just between you.                             | Tap submit with valid input | None  |
| Privacy line  | `savingReflection`  | Saving…                                              | Submit tap            | None        |
| Privacy line  | Default             | This is optional. It stays just between you and this moment. | Render        | None        |
| Keyboard hint | `keyboardVisible`   | Tap outside to dismiss keyboard                      | Keyboard show         | None        |

**Trigger:** Invitation by date; ack when user taps "Keep this note" and input is valid (≥2 visible chars); saving/optional by state.  
**Persistence:** Reflection text saved to `sunrise_logs.reflection_text` on submit and on blur/debounce when valid; copy strings not stored.

---

## 8. Witness Screen — Global Count

| Component   | Condition                    | Exact copy                                              | Trigger    | Persistence |
|------------|------------------------------|---------------------------------------------------------|------------|-------------|
| Global count | `hasLogged`, globalCount === 0  | Be the first to welcome the day with SunVantage today.   | RPC + render | None      |
| Global count | `hasLogged`, globalCount === 1  | You are the first to welcome the day with SunVantage today! | RPC + render | None   |
| Global count | `hasLogged`, globalCount >= 2   | {X} people have welcomed the day with SunVantage today.   | RPC + render | None      |

**Note:** Copy for "Be the second…" / "Be the third…" exists in code but is never shown (block is gated by `hasLogged`).  
**Trigger:** globalCount from `get_today_sunrise_count` RPC; block only when `hasLogged && globalCount !== null`.  
**Persistence:** Count from DB; copy not stored.

---

## 9. Witness Screen — Errors & Footer

| Component   | Condition     | Exact copy                                                         | Trigger        | Persistence |
|------------|---------------|--------------------------------------------------------------------|----------------|-------------|
| Error      | Load logs     | We could not check today's sunrise. Please try again later.        | API error      | None        |
| Error      | Load catch    | Something went wrong. Please try again later.                      | Exception      | None        |
| Error      | Log insert    | We could not log this sunrise. Please try again.                    | API error      | None        |
| Error      | Auth (photo)  | We could not find your account. Please sign in again.              | No session     | None        |
| Error      | Photo permission | We need permission to access your photos.                       | Permission denied | None   |
| Error      | Photo read    | We could not read the image. Please try another photo.             | Read fail      | None        |
| Error      | Photo upload  | We could not upload that photo. Please try again.                  | Upload fail    | None        |
| Error      | Photo save    | We could not save that photo. Please try again.                   | DB update fail | None        |
| Error      | Photo URL     | Photo saved, but we couldn't create a secure link to show it. …     | Signed URL fail| None        |
| Error      | Photo catch   | Something went wrong while adding your photo.                      | Exception      | None        |
| Error      | Sign out      | (signOutError.message or) We could not sign you out. Please try again. | Sign out fail | None |
| Footer     | Always        | Back to welcome                                                    | Render         | None        |
| Footer     | Always        | Sign out                                                            | Render         | None        |
| Footer     | Signing out   | Signing out…                                                        | signingOut     | None        |

**Trigger:** Errors set by API/exception handlers; footer label from state.  
**Persistence:** None; errors in component state only.

---

## 10. Cross-Screen Summary

| Screen      | Subheading source        | CTA / primary action source |
|-------------|--------------------------|-----------------------------|
| Welcome     | getRitualState(user, streak).subheading | getRitualState(user, streak).cta |
| Auth        | Static: See the day differently. | Sign in / Sign up (mode)   |
| Onboarding  | Static: See the day differently. | Continue                    |
| Witness     | getWitnessSubheading(currentStreak) | Witness today's sunrise (pre) / ✓ Sunrise witnessed (post) |

**Persistence behavior (app-wide):**
- No user-visible copy is stored in AsyncStorage or DB except:
  - Reflection body is persisted to `sunrise_logs.reflection_text`.
  - Photo URL and replace flag are persisted; success messages are session-only.
- All other strings are either static, derived from state/API at runtime, or set in code (errors/messages).

---

*End of copy logic matrix.*
