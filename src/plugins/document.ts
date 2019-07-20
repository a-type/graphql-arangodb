import { Plugin } from '../types';

export const document: Plugin = {
  directiveName: 'document',
  build: ({ fieldName, directiveArgs, getFieldArg, returnsList }) => {
    if (returnsList) {
      return `FOR ${fieldName} IN ${directiveArgs.collection}`;
    }

    return `LET ${fieldName} = DOCUMENT(${
      directiveArgs.collection
    }, "${getFieldArg(directiveArgs.id)}")`;
  },
};
