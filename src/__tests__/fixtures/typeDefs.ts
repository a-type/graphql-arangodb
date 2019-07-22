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
        direction: OUTBOUND
      )

    filteredPosts(titleMatch: String): [Post!]!
      @node(
        edgeCollection: "posted"
        direction: OUTBOUND
      )
      @filter(statement: "$field.title =~ $args.titleMatch")

    paginatedPosts(count: Int!, sort: String = "title", skip: Int): [Post!]!
      @node(
        edgeCollection: "posted"
        direction: OUTBOUND
      )
      @sort(property: "$args.sort")
      @limit(skip: "$args.skip", count: "$args.count")

    descendingPosts: [Post!]!
      @node(
        edgeCollection: "posted"
        direction: OUTBOUND
      )
      @sort(property: "title", order: DESC)

    friends: [FriendOfEdge!]!
      @edge(
        collection: "friendOf"
        direction: ANY
      )

    friendsOfFriends: [User!]!
      @subquery(
        query: """
        FOR $field IN 2..2 ANY $parent friendOf OPTIONS {bfs: true, uniqueVertices: 'path'}
        """
      )
  }

  type Post {
    id: ID!
    title: String!
    body: String!
  }

  type FriendOfEdge {
    strength: Int
    user: User! @edgeNode
  }

  type Query {
    user(id: ID!): User
      @document(
        collection: "users"
        key: "$args.id"
      )

    users: [User!]!
      @document(
        collection: "users"
      )

    authorizedPosts: [Post!]!
      @subquery(
        query: """
        LET authenticatedUser = DOCUMENT('users', $context.userId)
        LET allAuthorizedPosts = UNION_DISTINCT(
          (FOR post IN posts FILTER post.public == true RETURN post),
          (FOR post IN OUTBOUND authenticatedUser posted RETURN post)
        )
        FOR $field IN allAuthorizedPosts
        """
      )
  }
`;
