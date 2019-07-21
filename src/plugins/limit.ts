import { Plugin } from '../types';

export const limit: Plugin = {
  directiveName: 'limit',
  build: ({ directiveArgs }) => {
    return `LIMIT ${
      directiveArgs.skip !== undefined ? `${directiveArgs.skip}, ` : ''
    }${directiveArgs.count}`;
  },
};
