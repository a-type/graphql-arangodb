import { Plugin } from '../types';

export const filter: Plugin = {
  name: 'filter',
  build: ({ directiveArgs }) => {
    return `FILTER ${directiveArgs.statement}`;
  },
};
