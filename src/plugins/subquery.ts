import { Plugin } from '../types';

export const subquery: Plugin = {
  name: 'subquery',
  build: ({ directiveArgs }) => {
    return directiveArgs.statement;
  },
};
