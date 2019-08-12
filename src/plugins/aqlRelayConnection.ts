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
    cursorProperty,
    edgeDirection,
    edgeCollection,
    documentCollection,
    source,
    fullTextTerm,
    fullTextProperty,
    cursorOnEdge,
  } = directiveArgs;

  if (source === 'default' && documentCollection) {
    if (cursorOnEdge) {
      throw new Error(
        `Cannot use cursorOnEdge when Relay connection represents a basic document collection`
      );
    }

    return buildSubquery(
      lines([
        `FOR $field_node IN ${documentCollection}`,
        `FILTER !$args.after || $field_node.${cursorProperty} > $args.after`,
        `SORT $field_node.${cursorProperty}`,
        `LIMIT $args.first + 1`,
        `RETURN { cursor: $field_node.${cursorProperty}, node: $field_node }`,
      ]),
      true
    );
  }

  if (source === 'FullText') {
    if (cursorOnEdge) {
      throw new Error(
        `Cannot use cursorOnEdge when Relay connection is using FullText source`
      );
    }

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
        `FILTER !$args.after || $field_node.${cursorProperty} > $args.after`,
        `SORT $field_node.${cursorProperty}`,
        `LIMIT $args.first + 1`,
        `RETURN { cursor: $field_node.${cursorProperty}, node: $field_node }`,
      ]),
      true
    );
  }

  const cursorExpression = cursorOnEdge
    ? `$field_edge.${cursorProperty}`
    : `$field_node.${cursorProperty}`;

  return buildSubquery(
    lines([
      `FOR $field_node, $field_edge IN ${edgeDirection} $parent ${edgeCollection}`,
      indent(`PRUNE !$args.after || ${cursorExpression} > $args.after`),
      indent(`OPTIONS {bfs: true}`),
      `SORT ${cursorExpression}`,
      `LIMIT $args.first + 1`,
      `RETURN MERGE($field_edge, { cursor: ${cursorExpression}, node: $field_node })`,
    ]),
    true
  );
};
