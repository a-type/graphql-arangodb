# graphql-arangodb

An experimental library for 'translating' GraphQL operations into ArangoDB AQL queries which are designed to fetch all requested data in as few queries as possible. Flexibility is another objective; I want to empower the developer to define exactly how they want their GraphQL schema without being forced into a particular schema shape due to their database structure.

## Sketches

Since this library is still in early phase, I'll be sketching ideas on how it might work here.

Given a schema:

```graphql
enum RelationDirection {
  OUT
  IN
  ANY
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

input UserPostsFilterInput {
  publishedAtGt: Date
  publishedAtLt: Date
}

type User {
  id: ID!
  name: String!
  bio: String
  age: Int!

  posts(input: UserPostsFilterInput): [Post!]!
    @relation(
      name: "post"
      direction: OUT
    )

  friends(input: UserFriendsFilterInput): [User!]!
    @relation(
      name: "friend"
      direction: ANY
    )
}

input GetUserInput {
  id: ID
}

type Query {
  user(input: GetUserInput!): User
}
```

A GraphQL query:

```graphql
query UserWithFriendsPosts($userId: ID) {
  user(input: { id: $userId }) {
    id
    name
    friends(input: { ageGt: 10 }) {
      id
      name
      posts(input: { publishedAtGt: "2019-07-01" }) {
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
LET user = DOCUMENT('users', 'someid')
  RETURN {
    "id": user.id,
    "name": user.name,
    "friends": (
      FOR user_friends IN ANY user
        friend
        FILTER user_friends.age > 10
        RETURN {
          "id": user_friends.id,
          "name": user_friends.name,
          "posts": (
            FOR user_friends_posts IN OUTBOUND user_friends
              post
              FILTER user_friends_posts.publishedAt > DATE_ISO8601("2019-07-01")
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

---------

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
