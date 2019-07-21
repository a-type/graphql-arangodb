import { Plugin } from '../types';

export const edgeNode: Plugin = {
  build: ({ fieldName, parentName }) => {
    // this is assuming we are in the scope of a parent @edge subquery,
    // which is a safe assumption I think.
    return `LET ${fieldName} = ${parentName}_node`;
  },
};
