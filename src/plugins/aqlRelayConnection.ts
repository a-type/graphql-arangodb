import { Plugin } from '../types';
import { lines, indent } from '../utils/strings';
import { buildSubquery } from '../utils/aql';

export const aqlRelayConnection: Plugin = {
  name: 'aqlRelayConnection',
  build: ({ directiveArgs, returnsList, children }) => {
    const { edgeCollection, documentCollection } = directiveArgs;

    if (!documentCollection && !edgeCollection) {
      throw new Error(
        'Either edgeCollection or documentCollection must be supplied to a Relay collection directive'
      );
    }

    const listPlusOneSubquery = createListPlusOneSubquery(directiveArgs);

    return buildSubquery(
      lines([
        `LET $field_listPlusOne = ${listPlusOneSubquery}`,
        `LET $field = {`,
        indent(`edges: SLICE($field_listPlusOne, 0, $args.first),`),
        indent(`pageInfo: { `),
        indent(
          indent(`hasNextPage: LENGTH($field_listPlusOne) == $args.first + 1`)
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
    documentCollection,
    source,
    fullTextTerm,
    fullTextProperty,
  } = directiveArgs;

  const cursorExpression =
    (userCursorExpression &&
      interpolateUserCursorExpression(userCursorExpression)) ||
    '$field_node._key';

  if (source === 'default' && documentCollection) {
    return buildSubquery(
      lines([
        `FOR $field_node IN ${documentCollection}`,
        `FILTER !$args.after || ${cursorExpression} > $args.after`,
        `SORT ${cursorExpression}`,
        `LIMIT $args.first + 1`,
        `RETURN { cursor: ${cursorExpression}, node: $field_node }`,
      ]),
      true
    );
  }

  if (source === 'FullText') {
    if (!fullTextTerm || !fullTextProperty || !documentCollection) {
      throw new Error(
        'fullTextTerm, fullTextProperty, and documentCollection are both required for a fulltext Relay connection directive'
      );
    }

    return buildSubquery(
      lines([
        `FOR $field_node IN FULLTEXT(${documentCollection}, ${JSON.stringify(
          fullTextProperty
        )}, ${fullTextTerm})`,
        `FILTER !$args.after || ${cursorExpression} > $args.after`,
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
      `FILTER $field_node && (!$args.after || ${cursorExpression} > $args.after)`,
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
    .replace(/\$edge/g, `$field_edge`);
