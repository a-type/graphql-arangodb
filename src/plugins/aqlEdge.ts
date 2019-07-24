import { Plugin } from '../types';
import { lines, indent } from '../utils/strings';
import { buildQueryModifiers } from '../utils/aql';

export const aqlEdge: Plugin = {
  name: 'aqlEdge',
  build: ({ directiveArgs, returnsList }) => {
    const { direction, collection } = directiveArgs;

    if (returnsList) {
      return lines([
        `FOR $field_node, $field IN ${direction} $parent ${collection}`,
        indent(buildQueryModifiers(directiveArgs)),
      ]);
    }

    return lines([
      `LET $field = FIRST(`,
      indent(
        `FOR $field_i_node, $field_i IN ${direction} $parent ${collection}`
      ),
      indent(
        buildQueryModifiers({
          ...directiveArgs,
          limit: {
            count: '1',
          },
        })
      ),
      indent(`RETURN $field_i`),
      ')',
    ]);
  },
};
