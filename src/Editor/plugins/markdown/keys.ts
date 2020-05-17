export const KEY_CODE_HASH = 'digit3';
export const KEY_CODE_SPACE = 'space';
export const KEY_CODE_BACKSPACE = 'backpsace';
export const KEY_CODE_ENTER = 'enter';

export function sanitizeKeyCodeEvent(code: string) {
  return code.toLowerCase();
}

export function sanitizeInputKeyEvent(key: string, shiftState: boolean) {
  const sanitizedKey = key.toLowerCase();

  if (key === '8' && shiftState) {
    return '*';
  }
  else if (key === '-' && shiftState) {
    return '_';
  }
  else if (key === '`' && shiftState) {
    return '~';
  }

  return sanitizedKey;
}