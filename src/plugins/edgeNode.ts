import { Plugin } from '../types';

export const edgeNode: Plugin = {
  name: 'edgeNode',
  build: ({ parentName }) => {
    // this is assuming we are in the scope of a parent @edge subquery
    return `${parentName}_node`;
  },
};
