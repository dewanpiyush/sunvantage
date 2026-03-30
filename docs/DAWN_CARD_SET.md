# SunVantage — Dawn Card Set (Shared Ritual Layer)

For `components/DawnCardBottomSheet.tsx`.

| # | Verb | Prompt |
|---:|---|---|
| 1 | **ARRIVE** | The sun arrives each day. <br> So should you. |
| 2 | **WITNESS** | You are never alone in witnessing the sunrise. <br> It’s shared across the world. |
| 3 | **RESET** | The sun does not carry yesterday. <br> Neither do you have to. |
| 4 | **BREATHE** | Take a moment to pause. <br> You are part of something larger. |
| 5 | **ALIGN** | This rhythm has always existed. <br> You can still step into it. |
| 6 | **HOLD** | Let this moment linger. <br> Like the sun does, before it moves on. |
| 7 | **RECEIVE** | Not everything needs to be taken on. <br> Let some things simply be. |
| 8 | **RETURN** | You came back. <br> That’s how this becomes yours. |
| 9 | **RELEASE** | The night gives way, every time. <br> You can let things go too. |
| 10 | **CONTINUE** | Nothing remarkable may happen today. <br> And still—you continue. |
| 11 | **CONNECT** | The same sun reaches everyone. <br> It does not choose between us. |
| 12 | **STAND** | You never stand alone at sunrise. <br> It’s witnessed by many, everywhere. |
| 13 | **SHARE** | This ritual is not yours alone. <br> It is shared across the world. |
| 14 | **BELONG** | The sun meets everyone the same way. <br> You are part of that. |
| 15 | **FLOW** | From dawn to dusk, things keep moving. <br> You can move with them. |

## Selection logic (MVP — deterministic per-user)

**Goal**

- One card per day
- Same card all day
- Deterministic (no randomness)
- Each user progresses through the set based on **days since first open**

**Storage key**

- AsyncStorage key: `first_open_date`

**Implementation**

- Source: `lib/dawnCards.ts`

```ts
const FIRST_OPEN_KEY = 'first_open_date';

export const getDaysSinceFirstOpen = async (): Promise<number> => {
  // ensures FIRST_OPEN_KEY exists (sets it on first run)
  // then returns floor(days since that date)
};

export const getTodayDawnCard = async (): Promise<{ verb: string; text: string }> => {
  const days = await getDaysSinceFirstOpen();
  const index = days % DAWN_CARD_SET.length;
  return { verb: DAWN_CARD_SET[index].verb, text: DAWN_CARD_SET[index].prompt };
};
```

## Rendering / integration

**Home screen**

- Source: `app/home.tsx`
- Loads the selected card once on mount and passes it into the sheet:

```tsx
const [dawnCard, setDawnCard] = useState<DawnCard>({ verb: 'RESET', text: '...' });

useEffect(() => {
  (async () => setDawnCard(await getTodayDawnCard()))();
}, []);

{showDawnCard ? <DawnCardBottomSheet verb={dawnCard.verb} text={dawnCard.text} onDismissed={dismissDawnCard} /> : null}
```

**Bottom sheet**

- Source: `components/DawnCardBottomSheet.tsx`
- The prompt string uses `\n` line breaks (stored in `lib/dawnCardSet.ts`) and is rendered as text with newlines preserved by React Native’s `<Text>`.

