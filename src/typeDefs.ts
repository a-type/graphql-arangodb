export const directiveTypeDefs = `
enum EdgeDirection {
  OUT
  IN
  ANY
}

enum SortOrder {
  DESC
  ASC
}

directive @document(
  collection: String!
  id: String
) on FIELD_DEFINITION

directive @node(
  edgeCollection: String!
  direction: EdgeDirection!
) on FIELD_DEFINITION

directive @filter(
  statement: String!
) on FIELD_DEFINITION

directive @sort(
  fieldName: String!
  order: SortOrder
) on FIELD_DEFINITION

directive @limit(
  skip: String
  count: String!
) on FIELD_DEFINITION

directive @edge(
  direction: EdgeDirection!
  collection: String!
) on FIELD_DEFINITION

directive @edgeNode on FIELD_DEFINITION

directive @aql(
  statement: String!
) on FIELD_DEFINITION
`;
