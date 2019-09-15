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

    postsConnection(first: Int = 10, after: String!, filter: PostsConnectionFilter): UserPostsConnection!
      @aqlRelayConnection(
        edgeCollection: "posted"
        edgeDirection: OUTBOUND
        cursorExpression: "$node.title"
        filter: """
        (
          $args['filter'] != null && (
            $args['filter'].publishedAfter == null || $node.publishedAt > $args['filter'].publishedAfter
          ) && (
            $args['filter'].titleLike == null || LIKE($node.title, CONCAT("%", $args['filter'].titleLike, "%"))
          )
        )
        """
      )
  }

  input PostsConnectionFilter {
    publishedAfter: String
    titleLike: String
  }

  type Post {
    id: ID! @aqlKey
    title: String!
    body: String!
    publishedAt: String!
    author: User!
      @aqlNode(edgeCollection: "posted", direction: INBOUND)
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

  type PostsConnection {
    edges: [PostEdge!]! @aqlRelayEdges
    pageInfo: PostsPageInfo! @aqlRelayPageInfo
  }

  type PostEdge {
    cursor: String!
    node: Post! @aqlRelayNode
  }

  type PostsPageInfo {
    hasNextPage: Boolean!
    endCursor: String
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

    posts(first: Int = 10, after: String, searchTerm: String): PostsConnection!

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

  type CreatePostPayload {
    post: Post!
      @aqlNewQuery
      @aqlSubquery(
        query: """
        LET $field = DOCUMENT(posts, $parent._key)
        """
      )
  }

  type Mutation {
    """This tests custom resolver query support"""
    createUser: User!

    """Tests multi-query resolution to avoid 'read after write' errors"""
    createPost: CreatePostPayload!
      @aqlSubquery(
        query: """
        INSERT { title: "Fake post", body: "foo", publishedAt: "2019-05-03" }
        INTO posts
        OPTIONS { waitForSync: true }
        LET $field = {
          post: NEW
        }
        """
      )
  }
`;
