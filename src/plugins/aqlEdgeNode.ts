import { Plugin } from '../types';

export const aqlEdgeNode: Plugin = {
  name: 'aqlEdgeNode',
  build: ({ parentName }) => {
    // this is assuming we are in the scope of a parent @edge subquery
    return `${parentName}_node`;
  },
};
