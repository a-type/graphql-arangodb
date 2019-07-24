export const lines = (strings: (string | undefined)[], joiner = '\n') => {
  const existingLines = strings.filter(Boolean);
  if (existingLines.length) {
    return existingLines.join(joiner);
  }
  return '';
};

export const indent = (line: string) =>
  line &&
  line
    .split('\n')
    .map(l => `  ${l}`)
    .join('\n');
