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

directive @document(
  collection: String!
  key: String
  filter: String
  sort: AqlSortInput
  limit: AqlLimitInput
) on FIELD_DEFINITION

directive @node(
  edgeCollection: String!
  direction: AqlEdgeDirection!
  filter: String
  sort: AqlSortInput
  limit: AqlLimitInput
) on FIELD_DEFINITION

directive @edge(
  direction: AqlEdgeDirection!
  collection: String!
  filter: String
  sort: AqlSortInput
  limit: AqlLimitInput
) on FIELD_DEFINITION

directive @edgeNode on FIELD_DEFINITION

directive @aql(
  expression: String!
) on FIELD_DEFINITION

directive @subquery(
  query: String!
) on FIELD_DEFINITION

directive @key on FIELD_DEFINITION

directive @relayConnection(
  edgeCollection: String!
  edgeDirection: AqlEdgeDirection!
  cursorProperty: String!
) on FIELD_DEFINITION | OBJECT

directive @relayEdges on FIELD_DEFINITION | OBJECT

directive @relayPageInfo on FIELD_DEFINITION | OBJECT

directive @relayNode on FIELD_DEFINITION | OBJECT
`;
