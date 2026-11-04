import { describe, expect, it } from 'vitest';
import { validateText } from './forms.util';

describe('validateText', () => {
  it('returns the required message for empty and whitespace-only values', () => {
    expect(validateText('', 5, 'req')).toBe('req');
    expect(validateText('   ', 5, 'req')).toBe('req');
  });

  it('accepts empty values when no required message is given', () => {
    expect(validateText('', 5, null)).toBeNull();
    expect(validateText('   ', 5, null)).toBeNull();
  });

  it('accepts exactly max characters after trim', () => {
    expect(validateText('  abcde  ', 5, 'req')).toBeNull();
  });

  it('rejects max + 1 characters', () => {
    expect(validateText('abcdef', 5, 'req')).toBe('Не более 5 символов');
    expect(validateText('abcdef', 5, null)).toBe('Не более 5 символов');
  });
});
