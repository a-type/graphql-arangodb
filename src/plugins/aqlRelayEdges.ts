import { Plugin } from '../types';
import { lines } from '../utils/strings';
import { buildSubquery } from '../utils/aql';

export const aqlRelayEdges: Plugin = {
  name: 'aqlRelayEdges',
  build: ({ returnsList, children }) =>
    buildSubquery(
      lines([`FOR $field IN $parent.edges`, children()]),
      returnsList
    ),
};
