import { Plugin } from '../types';

export const sort: Plugin = {
  build: ({ directiveArgs }) => {
    // possibly dangerous? a check to see if this is meant to be an interpolation
    // or if we need to treat it as a literal string.
    const sortField = directiveArgs.fieldName.startsWith('$')
      ? directiveArgs.fieldName
      : `"${directiveArgs.fieldName}"`;
    return `SORT $field[${sortField}]${
      directiveArgs.order ? ` ${directiveArgs.order}` : ''
    }`;
  },
};
