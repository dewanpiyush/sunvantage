export const getEchoVariant = (verb: string): string => {
  switch (verb) {
    case 'ARRIVE':
      return 'You showed up.\nThat’s enough.';
    case 'WITNESS':
      return 'You were here for this.';
    case 'RESET':
      return 'You began again.';
    case 'BREATHE':
      return 'You paused.\nThat mattered.';
    case 'ALIGN':
      return 'You stepped into the rhythm.';
    case 'HOLD':
      return 'You stayed with the moment.';
    case 'RECEIVE':
      return 'You let it be.';
    case 'RETURN':
      return 'You came back.';
    case 'RELEASE':
      return 'You let something go.';
    case 'CONTINUE':
      return 'You kept going.';
    case 'CONNECT':
      return 'You were part of it.';
    case 'STAND':
      return 'You stood in this moment.';
    case 'SHARE':
      return 'You joined something shared.';
    case 'BELONG':
      return 'You were part of this.';
    case 'FLOW':
      return 'You moved with it.';
    default:
      return '';
  }
};

