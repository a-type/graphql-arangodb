import { Plugin } from '../types';

export const aql: Plugin = {
  build: ({ directiveArgs }) => {
    return directiveArgs.statement;
  },
};
