import { Plugin } from '../types';

export const aqlSubquery: Plugin = {
  name: 'aqlSubquery',
  build: ({ directiveArgs }) => {
    return directiveArgs.query;
  },
};
