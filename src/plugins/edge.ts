import { Plugin } from '../types';
import { lines, indent } from '../utils/strings';

export const edge: Plugin = {
  name: 'edge',
  build: ({ directiveArgs, returnsList, fieldName, parentName }) => {
    if (returnsList) {
      return `FOR ${fieldName}_node, ${fieldName} IN ${directiveArgs.direction} ${parentName} ${directiveArgs.edgeCollection}`;
    }

    return lines([
      `LET ${fieldName} = FIRST(`,
      indent(
        `FOR ${fieldName}_i_node, ${fieldName}_i IN ${directiveArgs.direction} ${parentName} ${directiveArgs.edgeCollection}`
      ),
      indent('LIMIT 1'),
      indent(`RETURN ${fieldName}_i`),
      ')',
    ]);
  },
};
