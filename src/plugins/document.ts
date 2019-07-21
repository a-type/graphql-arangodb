import { Plugin } from '../types';

export const document: Plugin = {
  build: ({ fieldName, directiveArgs, returnsList }) => {
    if (returnsList) {
      return `FOR ${fieldName} IN ${directiveArgs.collection}`;
    }

    // possibly dangerous? a check to see if this is meant to be an interpolation
    // or if we need to treat it as a literal string
    const id = directiveArgs.id.startsWith('$')
      ? directiveArgs.id
      : `"${directiveArgs.id}"`;
    return `LET ${fieldName} = DOCUMENT(${directiveArgs.collection}, ${id})`;
  },
};
