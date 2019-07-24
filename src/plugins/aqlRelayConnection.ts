import { Plugin } from '../types';
import { lines, indent } from '../utils/strings';

export const aqlRelayConnection: Plugin = {
  name: 'aqlRelayConnection',
  build: ({ directiveArgs }) => {
    const { cursorProperty, edgeDirection, edgeCollection } = directiveArgs;

    return lines([
      `LET $field_listPlusOne = (`,
      indent(
        `FOR $field_node, $field_edge IN ${edgeDirection} $parent ${edgeCollection}`
      ),
      indent(indent(`OPTIONS {bfs: true}`)),
      indent(`SORT $field_node.${cursorProperty}`),
      indent(`LIMIT $args.first + 1`),
      indent(
        `RETURN MERGE($field_edge, { cursor: $field_node.${cursorProperty}, node: $field_node })`
      ),
      `)`,
      `LET $field = {`,
      indent(`edges: SLICE($field_listPlusOne, 0, $args.first)`),
      indent(`pageInfo: { `),
      indent(
        indent(`hasNextPage: LENGTH($field_listPlusOne) == $args.first + 1`)
      ),
      indent('}'),
      `}`,
    ]);
  },
};
