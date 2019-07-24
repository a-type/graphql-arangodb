export const directiveTypeDefs = `
enum AqlEdgeDirection {
  OUTBOUND
  INBOUND
  ANY
}

enum AqlSortOrder {
  DESC
  ASC
}

input AqlSortInput {
  property: String!
  order: AqlSortOrder = ASC
}

input AqlLimitInput {
  count: String!
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
