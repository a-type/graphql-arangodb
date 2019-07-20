import { directiveTypeDefs } from '../../typeDefs';

export default `
  ${directiveTypeDefs}

  type User {
    id: ID!
    name: String!
    bio: String

    simplePosts: [Post!]!
      @node(
        edgeCollection: "posted"
        direction: OUT
      )
  }

  type Post {
    id: ID!
    title: String!
    body: String!
  }

  type Query {
    user(id: ID!): User
      @document(
        collection: "users"
        id: "$args.id"
      )

    users: [User!]!
      @document(
        collection: "users"
      )
  }
`;
