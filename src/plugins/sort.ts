import { Plugin } from '../types';

export const sort: Plugin = {
  name: 'sort',
  build: ({ directiveArgs }) => {
    // possibly dangerous? a check to see if this is meant to be an interpolation
    // or if we need to treat it as a literal string.
    const property = directiveArgs.property.startsWith('$')
      ? directiveArgs.property
      : `"${directiveArgs.property}"`;
    return `SORT $field[${property}]${
      directiveArgs.order ? ` ${directiveArgs.order}` : ''
    }`;
  },
};
