import { Plugin } from '../types';

export const virtual: Plugin = {
  name: 'virtual',
  build: ({ directiveArgs, returnsList, fieldName, parentName }) => {
    // this one is special; everything is done in the query builder.
    return '';
  },
};
