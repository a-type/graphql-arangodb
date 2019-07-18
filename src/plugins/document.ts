import { Plugin } from '../types';

export const document: Plugin = {
  directiveName: 'document',
  build: ({ fieldName, directiveArgs, getFieldArg }) =>
    `LET ${fieldName} = DOCUMENT(${directiveArgs.collection}, "${getFieldArg(
      directiveArgs.id
    )}")`,
};
