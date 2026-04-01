export type DawnCardCopy = {
  verb: string;
  prompt: string;
  completion: string;
};

/**
 * Dawn Card Set (Shared Ritual Layer)
 * Source of truth: `docs/DAWN_CARD_SET.md`
 */
export const DAWN_CARD_SET: DawnCardCopy[] = [
  { verb: 'ARRIVE', prompt: 'The sun arrives each day.\nSo should you.', completion: 'You arrived.' },
  { verb: 'WITNESS', prompt: 'You are never alone in witnessing the sunrise.\nIt’s shared across the world.', completion: 'You were here for this.' },
  { verb: 'RESET', prompt: 'The sun does not carry yesterday.\nNeither do you have to.', completion: 'You began again.' },
  { verb: 'BREATHE', prompt: 'Take a moment to pause.\nYou are part of something larger.', completion: 'You paused.' },
  { verb: 'ALIGN', prompt: 'This rhythm has always existed.\nYou can still step into it.', completion: 'You stepped into the rhythm.' },
  { verb: 'HOLD', prompt: 'Let this moment linger.\nLike the sun does, before it moves on.', completion: 'You stayed with the moment.' },
  { verb: 'RECEIVE', prompt: 'Not everything needs to be taken on.\nLet some things simply be.', completion: 'You let it be.' },
  { verb: 'RETURN', prompt: 'You came back.\nThat’s how this becomes yours.', completion: 'You came back.' },
  { verb: 'RELEASE', prompt: 'The night gives way, every time.\nYou can let things go too.', completion: 'You let something go.' },
  { verb: 'CONTINUE', prompt: 'Nothing remarkable may happen today.\nAnd still—you continue.', completion: 'You kept going.' },
  { verb: 'CONNECT', prompt: 'The same sun reaches everyone.\nIt does not choose between us.', completion: 'You were part of it.' },
  { verb: 'STAND', prompt: 'You never stand alone at sunrise.\nIt’s witnessed by many, everywhere.', completion: 'You stood in this moment.' },
  { verb: 'SHARE', prompt: 'This ritual is not yours alone.\nIt is shared across the world.', completion: 'You joined something shared.' },
  { verb: 'BELONG', prompt: 'The sun meets everyone the same way.\nYou are part of that.', completion: 'You were part of this.' },
  { verb: 'FLOW', prompt: 'From dawn to dusk, things keep moving.\nYou can move with them.', completion: 'You moved with it.' },
];

