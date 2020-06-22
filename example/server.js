// NOTE - in your code, this would be importing from graphql-arangodb
import { directiveTypeDefs, aqlResolver } from '../dist';
import { GraphQLServer } from 'graphql-yoga';
import { Database } from 'arangojs';

const typeDefs = `
  ${directiveTypeDefs}

  type User {
    id: ID! @aqlKey
    name: String!
    bio: String

    posts: [Post!]!
      @aqlNode(
        edgeCollection: "posted"
        direction: OUTBOUND
        # only show published posts for users
        filter: "$node.publishedAt != null"
      )

    # authenticated users can see their own drafts. for this subquery
    # we get the authenticated user using a context value of their id,
    # then if they equal the parent node we return drafts - otherwise
    # nothing.
    drafts: [Post!]
      @aqlSubquery(
        query: """
        LET authenticatedUser = DOCUMENT('users', $context.userId)
        LET allAuthorizedDrafts =
          authenticatedUser == $parent
            ? (FOR post IN OUTBOUND authenticatedUser posted FILTER post.publishedAt == null RETURN post)
            : null

        """
        return: "allAuthorizedDrafts"
      )

    friendships(first: Int = 10): [Friendship!]!
      @aqlEdge(
        collection: "friendOf"
        # inbound or outbound edges
        direction: ANY
        # sort by the friend User's name
        sort: { property: "name", sortOn: "$field_node" }
        # limit based on the passed argument
        limit: "$args.first"
      )
  }

  type Post {
    id: ID! @aqlKey
    title: String!
    body: String!
    publishedAt: String!
    author: User!
      @aqlNode(edgeCollection: "posted", direction: INBOUND)
  }

  type Friendship {
    strength: Int
    user: User! @aqlEdgeNode
  }

  type Query {
    user(id: ID!): User
      @aqlDocument(collection: "users", key: "$args.id")

    users: [User!]!
      @aqlDocument(collection: "users")
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
    createPost(title: String!, body: String!): CreatePostPayload!
      @aqlSubquery(
        query: """
        INSERT { title: $args.title, body: $args.body }
        INTO posts
        OPTIONS { waitForSync: true }
        LET $field = {
          post: NEW
        }
        """
      )
  }
`;

const resolvers = {
  Query: {
    user: aqlResolver,
    users: aqlResolver,
  },
  Mutation: {
    createPost: aqlResolver,
  },
  // important: because we split the query in this type,
  // a resolver is required
  CreatePostPayload: {
    post: aqlResolver,
  },
};

const arangoDb = new Database({
  url: 'http://localhost:8529',
});
arangoDb.useDatabase('exampleDb');
arangoDb.useBasicAuth('username', 'password');

const context = {
  arangoDb,
  // in a real app, you'd define your context as a function which
  // might check cookies or a JWT to determine the identity of
  // the requesting user.
  userId: 'some fake authenticated user id',
};

const server = new GraphQLServer({
  typeDefs,
  resolvers,
  context,
});

server.start(() => console.log('Server is running on localhost:4000'));
