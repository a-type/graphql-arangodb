import { Builder } from '../types';
import { lines } from '../utils/strings';
import { buildSubquery } from '../utils/aql';

export const aqlSubquery: Builder = {
  name: 'aqlSubquery',
  build: ({ directiveArgs, returnsList, children }) => {
    const { query, return: ret } = directiveArgs;

    return buildSubquery(
      lines([
        query,
        // if the user uses the "return" helper arg, we construct the right
        // field binding assignment for them to be returned by the return
        // projection construction
        ret && (returnsList ? `FOR $field IN ${ret}` : `LET $field = ${ret}`),
        children(),
      ]),
      returnsList
    );
  },
};
