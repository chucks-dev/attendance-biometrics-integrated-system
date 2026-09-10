// Format: FPN/NDM/2024/0000000001234
// FPN literal, then program code, then 4-digit year, then a numeric sequence (10-13 digits observed).
const APPLICATION_NUMBER_REGEX = /^FPN\/(NDE|NDM|HND)\/\d{4}\/\d{10,13}$/;

export function isValidApplicationNumber(value: string): boolean {
  return APPLICATION_NUMBER_REGEX.test(value);
}
