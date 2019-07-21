import { Plugin } from '../types';

export const document: Plugin = {
  directiveName: 'document',
  build: ({ fieldName, directiveArgs, returnsList }) => {
    if (returnsList) {
      return `FOR ${fieldName} IN ${directiveArgs.collection}`;
    }

    return `LET ${fieldName} = DOCUMENT(${directiveArgs.collection}, "${directiveArgs.id}")`;
  },
};
