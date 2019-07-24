import { directiveTypeDefs } from '../../typeDefs';

export default `
  ${directiveTypeDefs}

  type User {
    id: ID! @aqlKey
    name: String!
    bio: String

    fullName: String! @aql(expression: "CONCAT($parent.name, \\" \\", $parent.surname)")

    simplePosts: [Post!]!
      @aqlNode(
        edgeCollection: "posted"
        direction: OUTBOUND
      )

    filteredPosts(titleMatch: String): [Post!]!
      @aqlNode(
        edgeCollection: "posted"
        direction: OUTBOUND
        filter: "$field.title =~ $args.titleMatch"
      )

    paginatedPosts(count: Int!, sort: String = "title", skip: Int = 0): [Post!]!
      @aqlNode(
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
      @aqlNode(
        edgeCollection: "posted"
        direction: OUTBOUND
        sort: {
          property: "title"
          order: DESC
        }
      )

    bfsPosts: [Post!]!
      @aqlNode(
        edgeCollection: "posted"
        direction: OUTBOUND
        options: {
          bfs: true
        }
      )

    friends: [FriendOfEdge!]!
      @aqlEdge(
        collection: "friendOf"
        direction: ANY
      )

    friendsOfFriends: [User!]!
      @aqlSubquery(
        query: """
        FOR $field IN 2..2 ANY $parent friendOf OPTIONS {bfs: true, uniqueVertices: 'path'}
        """
      )

    postsConnection(first: Int = 10, after: String!): UserPostsConnection!
      @aqlRelayConnection(edgeCollection: "posted", edgeDirection: OUTBOUND, cursorProperty: "_key")
  }

  type Post {
    id: ID! @aqlKey
    title: String!
    body: String!
  }

  type FriendOfEdge {
    strength: Int
    user: User! @aqlEdgeNode
  }

  type UserPostsConnection {
    edges: [UserPostEdge!]! @aqlRelayEdges
    pageInfo: UserPostsPageInfo! @aqlRelayPageInfo
  }

  type UserPostEdge {
    cursor: String!
    node: Post! @aqlRelayNode
  }

  type UserPostsPageInfo {
    hasNextPage: Boolean
  }

  type Query {
    user(id: ID!): User
      @aqlDocument(
        collection: "users"
        key: "$args.id"
      )

    users: [User!]!
      @aqlDocument(
        collection: "users"
      )

    authorizedPosts: [Post!]!
      @aqlSubquery(
        query: """
        LET authenticatedUser = DOCUMENT('users', $context.userId)
        LET allAuthorizedPosts = UNION_DISTINCT(
          (FOR post IN posts FILTER post.public == true RETURN post),
          (FOR post IN OUTBOUND authenticatedUser posted RETURN post)
        )
        """
        return: "allAuthorizedPosts"
      )
  }
`;
