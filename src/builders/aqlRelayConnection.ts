import { Builder } from '../types';
import { lines, indent } from '../utils/strings';
import { buildSubquery } from '../utils/aql';

export const aqlRelayConnection: Builder = {
  name: 'aqlRelayConnection',
  build: ({ directiveArgs, returnsList, children }) => {
    const { edgeCollection, source } = directiveArgs;

    if (!source && !edgeCollection) {
      throw new Error(
        'Either edgeCollection or a custom source must be supplied to a Relay collection directive'
      );
    }

    const listPlusOneSubquery = createListPlusOneSubquery(directiveArgs);

    return buildSubquery(
      lines([
        `LET $field_listPlusOne = ${listPlusOneSubquery}`,
        `LET $field_pruned_edges = SLICE($field_listPlusOne, 0, $args.first)`,
        `LET $field = {`,
        indent(`edges: $field_pruned_edges,`),
        indent(`pageInfo: { `),
        indent(
          lines(
            [
              indent(
                `hasNextPage: LENGTH($field_listPlusOne) == $args.first + 1`
              ),
              indent(
                `startCursor: LENGTH($field_pruned_edges) > 0 ? FIRST($field_pruned_edges).cursor : null`
              ),
              indent(
                `endCursor: LENGTH($field_pruned_edges) > 0 ? LAST($field_pruned_edges).cursor : null`
              ),
            ],
            ',\n'
          )
        ),
        indent('}'),
        `}`,
        children(),
      ]),
      returnsList
    );
  },
};

const createListPlusOneSubquery = (directiveArgs: any) => {
  const {
    cursorExpression: userCursorExpression,
    edgeDirection,
    edgeCollection,
    source,
    filter,
  } = directiveArgs;

  const cursorExpression =
    (userCursorExpression &&
      interpolateUserCursorExpression(userCursorExpression)) ||
    '$field_node._key';

  const userFilter = filter ? interpolateUserCursorExpression(filter) : 'true';

  const cursorFilter = `(!$args.after || ${cursorExpression} > $args.after)`;

  if (source) {
    return buildSubquery(
      lines([
        interpolateUserCursorExpression(source),
        `FILTER ${cursorFilter} && ${userFilter}`,
        `SORT ${cursorExpression}`,
        `LIMIT $args.first + 1`,
        `RETURN { cursor: ${cursorExpression}, node: $field_node }`,
      ]),
      true
    );
  }

  return buildSubquery(
    lines([
      `FOR $field_node, $field_edge IN ${edgeDirection} $parent ${edgeCollection}`,
      indent(`OPTIONS {bfs: true}`),
      // filter out 'detached' edges which don't point to a node anymore
      `FILTER $field_node && ${cursorFilter} && ${userFilter}`,
      `SORT ${cursorExpression}`,
      `LIMIT $args.first + 1`,
      `RETURN MERGE($field_edge, { cursor: ${cursorExpression}, node: $field_node })`,
    ]),
    true
  );
};

// converts user-land "$node" and "$edge" into field-qualified interpolations used in the rest
// of this plugin
const interpolateUserCursorExpression = (cursorExpression: string) =>
  cursorExpression
    .replace(/\$node/g, `$field_node`)
    .replace(/\$edge/g, `$field_edge`)
    .replace(/\$path/g, `$field_path`);
