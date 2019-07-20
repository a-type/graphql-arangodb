import { Plugin } from '../types';
import { lines, indent } from '../utils/strings';

export const node: Plugin = {
  directiveName: 'node',
  build: ({
    directiveArgs,
    getFieldArg,
    returnsList,
    fieldName,
    parentName,
  }) => {
    if (returnsList) {
      return lines([
        `FOR ${fieldName} IN ${directiveArgs.direction} ${parentName}`,
        indent(directiveArgs.edgeCollection),
      ]);
    }

    return 'TODO';
  },
};
