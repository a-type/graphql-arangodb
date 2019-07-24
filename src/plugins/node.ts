import { Plugin } from '../types';
import { lines, indent } from '../utils/strings';
import { buildQueryModifiers } from '../utils/aql';

export const node: Plugin = {
  name: 'node',
  build: ({ directiveArgs, returnsList }) => {
    const { direction, edgeCollection } = directiveArgs;

    if (returnsList) {
      return lines([
        `FOR $field IN ${direction} $parent ${edgeCollection}`,
        indent(buildQueryModifiers(directiveArgs)),
      ]);
    }

    return lines([
      `LET $field = FIRST(`,
      indent(`FOR $field_i IN ${direction} $parent ${edgeCollection}`),
      indent(
        buildQueryModifiers({
          ...directiveArgs,
          limit: { count: '1' },
        })
      ),
      indent(`RETURN $field_i`),
      ')',
    ]);
  },
};
