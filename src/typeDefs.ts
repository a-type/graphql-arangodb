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

input AqlTraverseOptions {
  bfs: Boolean
  uniqueVertices: String
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
  options: AqlTraverseOptions
) on FIELD_DEFINITION

directive @aqlEdge(
  direction: AqlEdgeDirection!
  collection: String!
  filter: String
  sort: AqlSortInput
  limit: AqlLimitInput
  options: AqlTraverseOptions
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
  edgeCollection: String!
  edgeDirection: AqlEdgeDirection!
  cursorProperty: String!
) on FIELD_DEFINITION | OBJECT

directive @aqlRelayEdges on FIELD_DEFINITION | OBJECT

directive @aqlRelayPageInfo on FIELD_DEFINITION | OBJECT

directive @aqlRelayNode on FIELD_DEFINITION | OBJECT
`;
