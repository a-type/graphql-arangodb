import { Plugin } from '../types';
import { lines, indent } from '../utils/strings';

export const document: Plugin = {
  name: 'document',
  build: ({ fieldName, directiveArgs, returnsList }) => {
    if (returnsList) {
      return `FOR ${fieldName} IN ${directiveArgs.collection}`;
    }

    // for a singular field without a key arg, we just take the first
    // item out of the list
    if (!returnsList && !directiveArgs.key) {
      return lines([
        `FIRST(`,
        indent(`FOR ${fieldName}_i IN ${directiveArgs.collection}`),
        indent(`LIMIT 1`),
        indent(`RETURN ${fieldName}_i`),
        `)`,
      ]);
    }

    // possibly dangerous? a check to see if this is meant to be an interpolation
    // or if we need to treat it as a literal string
    const key = directiveArgs.key.startsWith('$')
      ? directiveArgs.key
      : `"${directiveArgs.key}"`;
    return `LET ${fieldName} = DOCUMENT(${directiveArgs.collection}, ${key})`;
  },
};
