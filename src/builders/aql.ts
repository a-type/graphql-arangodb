import { Builder } from '../types';

export const aql: Builder = {
  name: 'aql',
  build: ({ directiveArgs }) => {
    return directiveArgs.expression;
  },
};
