export const directiveTypeDefs = `
enum EdgeDirection {
  OUT
  IN
  ANY
}

directive @document(
  collection: String!
  id: String
) on FIELD_DEFINITION

directive @node(
  edgeCollection: String!
  direction: EdgeDirection!
) on FIELD_DEFINITION
`;
