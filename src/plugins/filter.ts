import { Plugin } from '../types';

export const filter: Plugin = {
  directiveName: 'filter',
  build: ({ directiveArgs }) => {
    return `FILTER ${directiveArgs.statement}`;
  },
};
