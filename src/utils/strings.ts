export const lines = (strings: (string | undefined)[], joiner = '\n') =>
  strings.filter(Boolean).join(joiner);

export const indent = (line: string) =>
  line
    .split('\n')
    .map(l => `  ${l}`)
    .join('\n');
