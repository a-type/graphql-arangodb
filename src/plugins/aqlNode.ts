import { Plugin } from '../types';
import { lines, indent } from '../utils/strings';
import { buildQueryModifiers, buildSubquery } from '../utils/aql';

export const aqlNode: Plugin = {
  name: 'aqlNode',
  build: ({ directiveArgs, returnsList, children }) => {
    const { direction, edgeCollection } = directiveArgs;

    return buildSubquery(
      lines([
        `FOR $field IN ${direction} $parent ${edgeCollection}`,
        indent(
          buildQueryModifiers({
            ...directiveArgs,
            limit: returnsList ? directiveArgs.limit : { count: '1' },
          })
        ),
        children(),
      ]),
      returnsList
    );
  },
};
