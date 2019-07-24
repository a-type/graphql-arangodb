import { Plugin } from '../types';
import { lines, indent } from '../utils/strings';
import { buildQueryModifiers, buildSubquery } from '../utils/aql';

export const aqlEdge: Plugin = {
  name: 'aqlEdge',
  build: ({ directiveArgs, returnsList, children }) => {
    const { direction, collection } = directiveArgs;

    return buildSubquery(
      lines([
        `FOR $field_node, $field IN ${direction} $parent ${collection}`,
        indent(
          buildQueryModifiers({
            ...directiveArgs,
            // enforce count 1 if this only resolves a single value
            limit: returnsList ? directiveArgs.limit : { count: '1' },
          })
        ),
        children(),
      ]),
      returnsList
    );
  },
};
