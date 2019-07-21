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

    filteredPosts(titleMatch: String): [Post!]!
      @node(
        edgeCollection: "posted"
        direction: OUT
      )
      @filter(statement: "$field.title =~ $args.titleMatch")

    paginatedPosts(count: Int!, sort: String = "title", skip: Int): [Post!]!
      @node(
        edgeCollection: "posted"
        direction: OUT
      )
      @sort(fieldName: "$args.sort")
      @limit(skip: "$args.skip", count: "$args.count")

    descendingPosts: [Post!]!
      @node(
        edgeCollection: "posted"
        direction: OUT
      )
      @sort(fieldName: "title", order: DESC)
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
