import { directiveTypeDefs } from '../../typeDefs';

export default `
  ${directiveTypeDefs}

  type User {
    id: ID! @key
    name: String!
    bio: String

    fullName: String! @aql(expression: "CONCAT($parent.name, \\" \\", $parent.surname)")

    simplePosts: [Post!]!
      @node(
        edgeCollection: "posted"
        direction: OUTBOUND
      )

    filteredPosts(titleMatch: String): [Post!]!
      @node(
        edgeCollection: "posted"
        direction: OUTBOUND
        filter: "$field.title =~ $args.titleMatch"
      )

    paginatedPosts(count: Int!, sort: String = "title", skip: Int = 0): [Post!]!
      @node(
        edgeCollection: "posted"
        direction: OUTBOUND
        sort: {
          property: "$args.sort"
        }
        limit: {
          skip: "$args.skip"
          count: "$args.count"
        }
      )

    descendingPosts: [Post!]!
      @node(
        edgeCollection: "posted"
        direction: OUTBOUND
        sort: {
          property: "title"
          order: DESC
        }
      )

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

    postsConnection(first: Int = 10, after: String!): UserPostsConnection!
      @relayConnection(edgeCollection: "posted", edgeDirection: OUTBOUND, cursorProperty: "_key")
  }

  type Post {
    id: ID! @key
    title: String!
    body: String!
  }

  type FriendOfEdge {
    strength: Int
    user: User! @edgeNode
  }

  type UserPostsConnection {
    edges: [UserPostEdge!]! @relayEdges
    pageInfo: UserPostsPageInfo! @relayPageInfo
  }

  type UserPostEdge {
    cursor: String!
    node: Post! @relayNode
  }

  type UserPostsPageInfo {
    hasNextPage: Boolean
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
