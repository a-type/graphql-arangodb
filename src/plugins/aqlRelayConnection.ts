import { Plugin } from '../types';
import { lines, indent } from '../utils/strings';
import { buildSubquery } from '../utils/aql';

export const aqlRelayConnection: Plugin = {
  name: 'aqlRelayConnection',
  build: ({ directiveArgs, returnsList, children }) => {
    const {
      cursorProperty,
      edgeDirection,
      edgeCollection,
      documentCollection,
      linkedList,
    } = directiveArgs;

    if (!documentCollection && !edgeCollection) {
      throw new Error(
        'Either edgeCollection or documentCollection must be supplied to a Relay collection directive'
      );
    }

    if (linkedList) {
      if (!edgeCollection) {
        throw new Error(
          'edgeCollection is required for a linked list Relay collection directive'
        );
      }

      return buildSubquery(lines([`LET $field_listPlusOne = `]), returnsList);
    }

    const listPlusOneSubquery = createListPlusOneSubquery(directiveArgs);

    return buildSubquery(
      lines([
        `LET $field_listPlusOne = ${listPlusOneSubquery}`,
        `LET $field = {`,
        indent(`edges: SLICE($field_listPlusOne, 0, $args.first)`),
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
    linkedList,
  } = directiveArgs;

  if (!linkedList && documentCollection) {
    return buildSubquery(
      lines([
        `FOR $field_node IN ${documentCollection}`,
        `FILTER $field_node.${cursorProperty} > $args.after`,
        `SORT $field_node.${cursorProperty}`,
        `LIMIT $args.first + 1`,
        `RETURN { cursor: $field_node.${cursorProperty}, node: $field_node }`,
      ]),
      true
    );
  }

  if (linkedList) {
    if (!edgeCollection || !documentCollection) {
      throw new Error(
        'edgeCollection and documentCollection are both required for a linked list Relay collection directive'
      );
    }

    return buildSubquery(
      lines([
        `LET $field_first = ${buildSubquery(
          lines([
            `FOR $field_first_candidate IN ${documentCollection}`,
            indent(
              `FILTER $field_first_candidate.${cursorProperty} == $args.cursor`
            ),
            indent(`LIMIT 1`),
            indent(`RETURN $field_first_candidate`),
          ]),
          false
        )}`,
        `LET firstPlusOne = $args.first + 1`,
        `FOR $field_node, $field_edge IN 1..firstPlusOne $field_first ${edgeCollection}`,
        indent(`OPTIONS {bfs: true}`),
        `SORT $field_node.${cursorProperty}`,
        `LIMIT $args.first + 1`,
        `RETURN MERGE($field_edge, { cursor: $field_node.${cursorProperty}, node: $field_node })`,
      ]),
      true
    );
  }

  return buildSubquery(
    lines([
      `FOR $field_node, $field_edge IN ${edgeDirection} $parent ${edgeCollection}`,
      indent(`OPTIONS {bfs: true}`),
      indent(`PRUNE $field_node.${cursorProperty} > $args.after`),
      `SORT $field_node.${cursorProperty}`,
      `LIMIT $args.first + 1`,
      `RETURN MERGE($field_edge, { cursor: $field_node.${cursorProperty}, node: $field_node })`,
    ]),
    true
  );
};
