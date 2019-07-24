import { Plugin } from '../types';
import { lines, indent } from '../utils/strings';
import { buildQueryModifiers } from '../utils/aql';

export const document: Plugin = {
  name: 'document',
  build: ({ directiveArgs, returnsList }) => {
    const { collection, key } = directiveArgs;

    if (returnsList) {
      return lines([
        `FOR $field IN ${collection}`,
        indent(buildQueryModifiers(directiveArgs)),
      ]);
    }

    // for a singular field without a key arg, we just take the first
    // item out of the list
    if (!returnsList && !key) {
      return lines([
        `LET $field = FIRST(`,
        indent(`FOR $field_i IN ${collection}`),
        indent(
          buildQueryModifiers({
            ...directiveArgs,
            limit: {
              count: '1',
            },
          })
        ),
        indent(`RETURN $field_i`),
        `)`,
      ]);
    }

    // possibly dangerous? a check to see if this is meant to be an interpolation
    // or if we need to treat it as a literal string
    const resolvedKey = key.startsWith('$') ? key : `"${key}"`;
    return `LET $field = DOCUMENT(${collection}, ${resolvedKey})`;
  },
};
