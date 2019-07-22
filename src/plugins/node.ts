import { Plugin } from '../types';
import { lines, indent } from '../utils/strings';

export const node: Plugin = {
  name: 'node',
  build: ({ directiveArgs, returnsList, fieldName, parentName }) => {
    if (returnsList) {
      return `FOR ${fieldName} IN ${directiveArgs.direction} ${parentName} ${directiveArgs.edgeCollection}`;
    }

    return lines([
      `LET ${fieldName} = FIRST(`,
      indent(
        `FOR ${fieldName}_i IN ${directiveArgs.direction} ${parentName} ${directiveArgs.edgeCollection}`
      ),
      indent('LIMIT 1'),
      indent(`RETURN ${fieldName}_i`),
      ')',
    ]);
  },
};
