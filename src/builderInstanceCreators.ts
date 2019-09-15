import { BuilderInstance } from './types';
import builders from './builders';

export const builderCreators = {
  aql: (args: { expression: string }): BuilderInstance => ({
    builder: builders.aql,
    directiveArgs: args,
  }),

  aqlDocument: (args: {
    collection: string;
    key: string;
    filter?: string;
    sort?: AqlSortInput;
    limit: AqlLimitInput;
  }): BuilderInstance => ({
    builder: builders.aqlDocument,
    directiveArgs: args,
  }),

  aqlEdge: (args: {
    direction: AqlEdgeDirection;
    collection: string;
    options?: AqlTraverseOptionsInput;
  }): BuilderInstance => ({
    builder: builders.aqlEdge,
    directiveArgs: args,
  }),

  aqlNode: (args: {
    edgeCollection: string;
    direction: AqlEdgeDirection;
    filter?: string;
    sort?: AqlSortInput;
    limit?: AqlLimitInput;
    options?: AqlTraverseOptionsInput;
  }): BuilderInstance => ({
    builder: builders.aqlNode,
    directiveArgs: args,
  }),

  aqlEdgeNode: (): BuilderInstance => ({
    builder: builders.aqlEdgeNode,
    directiveArgs: {},
  }),

  aqlSubquery: (args: { query: string; return?: string }): BuilderInstance => ({
    builder: builders.aqlSubquery,
    directiveArgs: args,
  }),

  aqlKey: (): BuilderInstance => ({
    builder: builders.aqlKey,
    directiveArgs: {},
  }),

  aqlRelayConnection: (args: {
    edgeCollection?: string;
    edgeDirection?: AqlEdgeDirection;
    documentCollection?: string;
    cursorExpression?: string;
    source?: string;
    filter?: string;
    sortOrder?: AqlSortOrder;
  }): BuilderInstance => ({
    builder: builders.aqlRelayConnection,
    directiveArgs: args,
  }),

  aqlRelayEdges: (): BuilderInstance => ({
    builder: builders.aqlRelayEdges,
    directiveArgs: {},
  }),

  aqlRelayPageInfo: (): BuilderInstance => ({
    builder: builders.aqlRelayPageInfo,
    directiveArgs: {},
  }),

  aqlRelayNode: (): BuilderInstance => ({
    builder: builders.aqlRelayNode,
    directiveArgs: {},
  }),
};

export type AqlEdgeDirection = 'INBOUND' | 'OUTBOUND';
export type AqlSortOrder = 'ASC' | 'DESC';

export type AqlSortInput = {
  property: string;
  order?: AqlSortOrder;
  sortOn?: string;
};

export type AqlLimitInput = {
  count: string;
  skip?: string;
};

export type AqlTraverseOptionsInput = {
  bfs?: boolean;
  uniqueVertices?: string;
  uniqueEdges?: string;
};
