import { Plugin } from '../types';

export const filter: Plugin = {
  build: ({ directiveArgs }) => {
    return `FILTER ${directiveArgs.statement}`;
  },
};
