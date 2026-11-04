export function validateText(
  value: string,
  maxLength: number,
  requiredMessage: string | null,
): string | null {
  const { length } = value.trim();

  if (requiredMessage !== null && length === 0) {
    return requiredMessage;
  }

  if (length > maxLength) {
    return `Не более ${maxLength} символов`;
  }

  return null;
}
