import { Builder } from '../types';
import { lines } from '../utils/strings';
import { buildSubquery } from '../utils/aql';

export const aqlRelayNode: Builder = {
  name: 'aqlRelayNode',
  build: ({ returnsList, children }) =>
    buildSubquery(
      lines([`LET $field = $parent.node`, children()]),
      returnsList
    ),
};
