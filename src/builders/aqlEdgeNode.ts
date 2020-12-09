import { Builder } from '../types';
import { lines } from '../utils/strings';
import { buildSubquery } from '../utils/aql';

export const aqlEdgeNode: Builder = {
  name: 'aqlEdgeNode',
  build: ({ parentName, returnsList, children }) => {
    // this is assuming we are in the scope of a parent @edge subquery
    return buildSubquery(
      lines([`LET $field = ${parentName}_node`, children()]),
      returnsList
    );
  },
};
