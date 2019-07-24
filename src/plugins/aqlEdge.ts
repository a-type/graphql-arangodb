import { Plugin } from '../types';
import { lines, indent } from '../utils/strings';
import { buildQueryModifiers, buildSubquery, buildOptions } from '../utils/aql';

export const aqlEdge: Plugin = {
  name: 'aqlEdge',
  build: ({ directiveArgs, returnsList, children }) => {
    const { direction, collection, options } = directiveArgs;

    return buildSubquery(
      lines([
        `FOR $field_node, $field IN ${direction} $parent ${collection}`,
        indent(buildOptions(options)),
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
