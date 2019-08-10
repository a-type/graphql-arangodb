import { Plugin } from '../types';
import { lines, indent } from '../utils/strings';
import { buildQueryModifiers, buildSubquery } from '../utils/aql';

export const aqlDocument: Plugin = {
  name: 'aqlDocument',
  build: ({ directiveArgs, returnsList, children }) => {
    const { collection, key } = directiveArgs;

    if (returnsList) {
      return buildSubquery(
        lines([
          `FOR $field IN ${collection}`,
          indent(buildQueryModifiers(directiveArgs)),
          children(),
        ]),
        returnsList
      );
    }

    // for a singular field without a key arg, we just take the first
    // item out of the list
    if (!returnsList && !key) {
      return buildSubquery(
        lines([
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
          children(),
        ]),
        returnsList
      );
    }

    // possibly dangerous? a check to see if this is meant to be an interpolation
    // or if we need to treat it as a literal string
    const resolvedKey = key.startsWith('$') ? key : `"${key}"`;
    return buildSubquery(
      lines([
        `LET $field = DOCUMENT(${collection}, ${resolvedKey})`,
        children(),
      ]),
      returnsList
    );
  },
};
