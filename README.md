# graphql-arangodb

An experimental library for 'translating' GraphQL operations into ArangoDB AQL queries which are designed to fetch all requested data in as few queries as possible. Flexibility is another objective; I want to empower the developer to define exactly how they want their GraphQL schema without being forced into a particular schema shape due to their database structure.

## Sketches

Since this library is still in early phase, I'll be sketching ideas on how it might work here.

### Query Translation

Given a schema:

```graphql
enum RelationDirection {
  OUT
  IN
  ANY
}

enum SortOrder {
  ASC
  DESC
}

scalar Date

type Post {
  id: ID!
  title: String!
  body: String
  publishedAt: Date!
}

input UserFriendsFilterInput {
  ageGt: Int
  ageLt: Int
}

input UserFriendsPaginationInput {
  offset: Int
  count: Int = 10
}

input UserFriendsSortInput {
  order: SortOrder
  value: String
}

input UserFriendsInput {
  filter: UserFriendsFilterInput
  pagination: UserFriendsPaginationInput
  sort: UserFriendsSortInput
}

input UserPostsFilterInput {
  publishedAtGt: Date
  publishedAtLt: Date
}

input UserPostsPaginationInput {
  offset: Int
  count: Int = 10
}

input UserPostsSortInput {
  order: SortOrder
  value: string
}

input UserPostsInput {
  filter: UserPostsFilterInput
  pagination: UserPostsPaginationInput
  sort: UserPostsSortInput
}

type User {
  id: ID!
  name: String!
  bio: String
  age: Int!

  posts(input: UserPostsInput): [Post!]!
    @node(edgeCollection: "post", direction: OUT)

  friends(input: UserFriendsInput): [User!]!
    @node(edgeCollection: "friend", direction: ANY)
}

input GetUserInput {
  id: ID
}

type Query {
  user(input: GetUserInput!): User
    @document(collection: "users", key: "$args.input.id")
}
```

A GraphQL query:

```graphql
query UserWithFriendsPosts($userId: ID) {
  user(input: { id: $userId }) {
    id
    name
    friends(input: { filter: { ageGt: 10 } }) {
      id
      name
      posts(input: { filter: { publishedAtGt: "2019-07-01" } }) {
        id
        title
        body
      }
    }
  }
}
```

Running that query:

```
// this would be in a client or language of your choice
graphql(UserWithFriendsPosts, { userId: 'someid' })
```

Would create an AQL query:

```aql
LET user = DOCUMENT(users, 'someid')
  RETURN {
    "id": user.id,
    "name": user.name,
    "friends": (
      FOR user_friends IN ANY user
        friend
        FILTER user_friends.age > 10
        LIMIT 10
        RETURN {
          "id": user_friends.id,
          "name": user_friends.name,
          "posts": (
            FOR user_friends_posts IN OUTBOUND user_friends
              post
              FILTER user_friends_posts.publishedAt > DATE_ISO8601("2019-07-01")
              LIMIT 10
              RETURN {
                "id": user_friends_posts.id,
                "title": user_friends_posts.title,
                "body": user_friends_posts.body
              }
          )
        }
    )
  }
```

### Library Usage

After experiments in this space yielding pretty tricky edge-cases for customization, I'm thinking about moving in a more framework-esque direction where this library is your primary method of constructing the final executable schema, for maximum control. This also makes sense with ArangoDB, since it's multi-model and can therefore act as your holistic data store for a larger number of use cases.

```ts
import { makeSchema } from 'graphql-arangodb';
import { Database, aql } from 'arangojs';

const typeDefs = `
  ... graphql schema with directives for arango queries
`;

// argumentResolvers allow you to modify incoming args before inserting them
// into the AQL query. They must be separate because we are not guaranteed to actually
// run the 'real' resolvers before the query is built and submitted.
// TODO: validate this constraint / assumption more carefully to see if this can
// be reworked to use normal resolvers.
const argumentResolvers = {
  Query: {
    User: {
      posts: ({ pagination, ...rest }) => ({
        ...rest,
        pagination: {
          // providing some defaults manually.. this could be done
          // in the schema directly, but for the sake of example
          offset: 0,
          limit: 10,
          ...(pagination || {}),
        },
      }),
    },
  },
};

// these are more analogous to regular GraphQL resolvers. The `parent` is an async
// function that resolves the parent data. You need to await it to get parent data.
const customResolvers = {
  Query: {
    User: {
      // suppose we wanted to enforce names are all UPPERCASE
      name: async (loadParent, args, ctx, info) => {
        const user = await loadParent();

        return user.name.toUpperCase();
      },
    },
  },
};

const db = new Database();

const schema = makeSchema({
  typeDefs,
  argumentResolvers,
  resolvers: customResolvers,
  db,
});
```

---

This project was bootstrapped with [TSDX](https://github.com/jaredpalmer/tsdx).

### Local Development

Below is a list of commands you will probably find useful.

#### `npm start` or `yarn start`

Runs the project in development/watch mode. Your project will be rebuilt upon changes. TSDX has a special logger for you convenience. Error messages are pretty printed and formatted for compatibility VS Code's Problems tab.

<img src="https://user-images.githubusercontent.com/4060187/52168303-574d3a00-26f6-11e9-9f3b-71dbec9ebfcb.gif" width="600" />

Your library will be rebuilt if you make edits.

#### `npm run build` or `yarn build`

Bundles the package to the `dist` folder.
The package is optimized and bundled with Rollup into multiple formats (CommonJS, UMD, and ES Module).

<img src="https://user-images.githubusercontent.com/4060187/52168322-a98e5b00-26f6-11e9-8cf6-222d716b75ef.gif" width="600" />

#### `npm test` or `yarn test`

Runs the test watcher (Jest) in an interactive mode.
By default, runs tests related to files changed since the last commit.
