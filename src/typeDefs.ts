export const directiveTypeDefs = `
"""Represents the direction of an edge in the graph relative to the current node"""
enum AqlEdgeDirection {
  OUTBOUND
  INBOUND
  ANY
}

"""Represents the order of a sorting operation"""
enum AqlSortOrder {
  DESC
  ASC
}

input AqlSortInput {
  """The property to sort on"""
  property: String!
  """The order to sort in. Defaults ASC"""
  order: AqlSortOrder = ASC
  """Change the object being sorted. Defaults to $field"""
  sortOn: String
}

input AqlLimitInput {
  """The upper limit of documents to return"""
  count: String!
  """The number of documents to skip"""
  skip: String
}

input AqlTraverseOptionsInput {
  """Enables breadth-first search"""
  bfs: Boolean
  """
  - "path": guarantees no path is returned with a duplicate vertex
  - "global": guarantees each vertex is visited at most once for the whole traversal
  - "none": (default) no uniqueness check
  """
  uniqueVertices: String
  """
  - "path": (default) guarantees no path is returned with a duplicate edge
  - "none": allows paths to 'double back' onto edges cyclically
  """
  uniqueEdges: String
}

directive @aqlDocument(
  collection: String!
  key: String
  filter: String
  sort: AqlSortInput
  limit: AqlLimitInput
) on FIELD_DEFINITION

directive @aqlNode(
  edgeCollection: String!
  direction: AqlEdgeDirection!
  filter: String
  sort: AqlSortInput
  limit: AqlLimitInput
  options: AqlTraverseOptionsInput
) on FIELD_DEFINITION

directive @aqlEdge(
  direction: AqlEdgeDirection!
  collection: String!
  filter: String
  sort: AqlSortInput
  limit: AqlLimitInput
  options: AqlTraverseOptionsInput
) on FIELD_DEFINITION

directive @aqlEdgeNode on FIELD_DEFINITION

directive @aql(
  expression: String!
) on FIELD_DEFINITION

directive @aqlSubquery(
  query: String!
  return: String
) on FIELD_DEFINITION

directive @aqlKey on FIELD_DEFINITION

directive @aqlRelayConnection(
  edgeCollection: String
  edgeDirection: AqlEdgeDirection
  documentCollection: String
  cursorProperty: String!
) on FIELD_DEFINITION | OBJECT

directive @aqlRelayEdges on FIELD_DEFINITION | OBJECT

directive @aqlRelayPageInfo on FIELD_DEFINITION | OBJECT

directive @aqlRelayNode on FIELD_DEFINITION | OBJECT
`;
