export function checkSafeName(name: string) {
  if (name === undefined || name === null) return false;
  const value = String(name).trim();
  return value.length > 0 && /^[A-Za-z0-9_-]+$/.test(value);
}
