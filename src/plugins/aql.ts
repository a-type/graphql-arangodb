import { Plugin } from '../types';

export const aql: Plugin = {
  name: 'aql',
  build: ({ directiveArgs }) => {
    return directiveArgs.expression;
  },
};
