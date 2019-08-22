import { Builder } from '../types';
import { lines } from '../utils/strings';
import { buildSubquery } from '../utils/aql';

export const aqlRelayPageInfo: Builder = {
  name: 'aqlRelayPageInfo',
  build: ({ returnsList, children }) =>
    buildSubquery(
      lines([`LET $field = $parent.pageInfo`, children()]),
      returnsList
    ),
};
