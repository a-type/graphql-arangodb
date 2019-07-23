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

directive @document(
  collection: String!
  key: String
) on FIELD_DEFINITION

directive @node(
  edgeCollection: String!
  direction: AqlEdgeDirection!
) on FIELD_DEFINITION

directive @filter(
  statement: String!
) on FIELD_DEFINITION

directive @sort(
  property: String!
  order: AqlSortOrder
) on FIELD_DEFINITION

directive @limit(
  skip: String
  count: String!
) on FIELD_DEFINITION

directive @edge(
  direction: AqlEdgeDirection!
  collection: String!
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
