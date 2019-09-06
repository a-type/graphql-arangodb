# graphql-arangodb

An experimental library for 'translating' GraphQL operations into ArangoDB AQL queries which are designed to fetch all requested data in as few queries as possible. Flexibility is another objective; I want to empower the developer to define exactly how they want their GraphQL schema without being forced into a particular schema shape due to their database structure.

- [graphql-arangodb](#graphql-arangodb)
  - [Setup](#setup)
    - [Installing](#installing)
    - [Directive type definitions](#directive-type-definitions)
    - [Adding a Database instance](#adding-a-database-instance)
    - [Resolvers](#resolvers)
      - [Customizing the resolver](#customizing-the-resolver)
  - [Usage](#usage)
    - [Enums](#enums)
    - [Inputs](#inputs)
    - [Interpolations](#interpolations)
    - [Directives](#directives)
      - [`@aqlDocument`](#aqldocument)
      - [`@aqlNode`](#aqlnode)
      - [`@aqlEdge/@aqlEdgeNode`](#aqledgeaqledgenode)
      - [`@aqlSubquery`](#aqlsubquery)
      - [`@aql`](#aql)
      - [`@aqlKey`](#aqlkey)
    - [Relay Directives (Experimental)](#relay-directives-experimental)
      - [`@aqlRelayConnection`](#aqlrelayconnection)
      - [`@aqlRelayEdges`](#aqlrelayedges)
      - [`@aqlRelayPageInfo`](#aqlrelaypageinfo)
      - [`@aqlRelayNode`](#aqlrelaynode)
    - [Running Custom Queries (Experimental)](#running-custom-queries-experimental)
    - [Mutations (Experimental)](#mutations-experimental)
  - [Development](#development)
    - [Local Development](#local-development)
      - [`npm start` or `yarn start`](#npm-start-or-yarn-start)
      - [`npm run build` or `yarn build`](#npm-run-build-or-yarn-build)
      - [`npm test` or `yarn test`](#npm-test-or-yarn-test)

## Setup

### Installing

Start by installing the library

```
npm i --save graphql-arangodb
```

You may also need to install peer dependencies if you don't have them:

```
npm i --save graphql graphql-middleware arangojs
```

### Directive type definitions

To use the directives in this library, you need to add type definitions for them. The library exports pre-built type definitions for all directives, you just need to include them in your type definitions.

```ts
import { directiveTypeDefs } from 'graphql-arangodb';

const typeDefs = [directiveTypeDefs, ...allYourAppsOtherTypeDefs];

makeExecutableSchema({ typeDefs });
```

### Adding a Database instance

The easiest way to connect `graphql-arangodb` to your ArangoDB database is to instantiate a `Database` class from `arangojs` and assign it to the `arangoDb` field of your GraphQL `context`:

```ts
const arangoDb = new Database({
  url: 'http://localhost:8529',
});
arangoDb.useDatabase('mydb');
arangoDb.useBasicAuth('mysecretuser', 'mysecretpassword');

const context = {
  arangoDb,
};

// pass the context into your GraphQL server according to documentation of the server
```

### Resolvers

To start resolving queries using AQL, you need to set up resolvers for fields which will be resolved using those queries. For most use cases, this means all of the top-level fields in the root query and mutation types.

For most people, adding the default `aqlResolver` from `graphql-arangodb` should be enough:

```ts
import aqlResolver from 'graphql-arangodb';

const resolvers = {
  Query: {
    user: aqlResolver,
    users: aqlResolver,
    // ...
  },
};
```

#### Customizing the resolver

However, there are some advanced scenarios where you may want to customize how the resolver works. To do this, you can import `createResolver` and create your own version of the default resolver. All config properties are optional.

```ts
import { createResolver, plugins as defaultPlugins } from 'graphql-arangodb';

const resolver = createResolver({
  // argument resolvers are called like regular resolvers, but they are used only by
  // graphql-arangodb to apply custom transformations to field arguments before
  // adding them to the AQL query. They are separated from normal resolvers for
  // technical reasons related to how queries are extracted and built by the library.
  // Whenver possible, prefer to put this logic inside the AQL query itself.
  argumentResolvers: {
    Query: {
      searchUsers: args => ({
        ...args,
        // apply Lucene fuzzy indicator to user's match string before passing it to AQL
        match: `${args.match}~`,
      }),
    },
  },

  // customize the key in your context which stores data which will be passed down
  // into AQL queries via the $context interpolation
  contextKey: 'arango_context',

  // customize the context property which is used to get your Database instance
  contextDbKey: 'arango_db',

  // advanced: you can reassign the names of the default directive plugins, or
  // create your own plugin here. Plugins aren't documented yet, see source.
  plugins: {
    ...defaultPlugin,
    custom: myCustomPlugin,
  },

  // you can specify a static database instance instead of passing one through context
  db: new Database(),
});
```

## Usage

Now that the library is configured, you can start adding directives to indicate how to query for your data.

Usage of these directives is fairly similar to writing subqueries directly in AQL. The main thing to know is that you never write the `RETURN` statement. This library automatically constructs the correct `RETURN` projections based on the selected fields in the GraphQL query.

### Enums

Before we begin with the directives, this library also ships some enums which will be used in directive parameters. To use an enum, just supply its literal value to the parameter (don't enclose it in `"` marks).

- `AqlEdgeDirection`: `OUTBOUND | INBOUND | ANY`
- `AqlSortOrder`: `DESC | ASC`
- `AqlRelayConnectionSource`: `Default | FullText`

### Inputs

Some directives take complex inputs:

```graphql
input AqlSortInput {
  """
  The property to sort on
  """
  property: String!
  """
  The order to sort in. Defaults ASC
  """
  order: AqlSortOrder = ASC
  """
  Change the object being sorted. Defaults to $field
  """
  sortOn: String
}

input AqlLimitInput {
  """
  The upper limit of documents to return
  """
  count: String!
  """
  The number of documents to skip
  """
  skip: String
}

"""
These are the same as the OPTIONS for a regular edge traversal in AQL
"""
input AqlTraversalOptionsInput {
  bfs: Boolean
  uniqueVertices: String
  uniqueEdges: String
}
```

### Interpolations

All directives support the following interpolations in their parameter values:

- `$parent`: Reference the parent document. If there is no parent (this is a root field in the query), references the `parent` from GraphQL, if that exists.
- `$field`: Reference the field itself. In `@aql` directives, you must assign something to this binding to be returned as the value of the field. For all other purposes, you can use this to reference the current value (for instance, if you want to do a filter on `$field.name` or some other property).
- `$args`: Reference the field args of the GraphQL query. You can use nested arg values. Usages of `$args` get turned into bind variables when the query is executed, and all field args are passed in as values.
- `$context`: Reference values from the `arangoContext` key in your GraphQL context. Use this for global values across all queries, like the authenticated user ID.

### Directives

#### `@aqlDocument`

Selects a single or multiple documents (depending on whether the return type of the field is a list) from a specified collection. If a single document is selected, you can supply an `key` parameter to select it directly. This `key` parameter may be an argument interpolation (`$args.id`, etc), or a concrete value. It is passed directly into the `DOCUMENT` AQL function as the second parameter. If you do not specify an `key` parameter, the first item from the collection will be returned. To select a single item with a filter, use `@aql`.

**Parameters**

- `collection: String!`: The name of the collection of documents
- `key: String`: A string value or interpolation that indicates the database key of the document.
- `filter: String`: Adds a filter expression. Applies to key-based single document fetching (the first document will be taken after filter is applied).
- `sort: AqlSortInput`: Adds a sort expression. Applies to key-based single document fetching (the first document will be taken after sort is applied).
- `limit: AqlLimitInput`: Adds a limit expression. Only works when `key` is not provided.

**Example**

```graphql
type Query {
  user(id: ID!): User @aqlDocument(collection: "users", key: "$args.id")
}
```

#### `@aqlNode`

Traverses a relationship from the parent document to another document across an edge. `@aqlNode` skips over the edge and returns the related document as the field value. If you want to utilize properties from the edge, use `@aqlEdge/@aqlEdgeNode` instead.

**Parameters**

- `edgeCollection: String!`: The name of the collection which the edge belongs to
- `direction: AqlEdgeDirection!`: The direction to traverse. Can be `ANY`.
- `filter: String`: Adds a filter expression.
- `sort: AqlSortInput`: Adds a sort expression.
- `limit: AqlLimitInput`: Adds a limit expression.
- `options: AqlTraverseOptionsInput`: Modify OPTIONS parameters on the traversal.

**Example**

```graphql
type User {
  posts: [Post!]! @aqlNode(edgeCollection: "posted", direction: OUTBOUND)
}
```

#### `@aqlEdge/@aqlEdgeNode`

`@aqlEdge` traverses an edge from the parent document, returning the edge itself as the field value. `@aqlEdgeNode` can be used on the type which represents the edge to reference the document at the other end of it. `@aqlEdgeNode` should only be used on a field within a type represented by an edge. It has no directive parameters.

**Parameters**

Only `@aqlEdge` takes parameters:

- `collection: String!`: The name of the collection for the edge
- `direction: AqlEdgeDirection!`: The direction to traverse. Can be `ANY`.
- `filter: String`: Adds a filter expression. To filter on the node, you can use `$field_node` as an interpolation. Defaults `sortOn` to `$field`.
- `sort: AqlSortInput` Adds a sort expression.
- `limit: AqlLimitInput`: Adds a limit expression.
- `options: AqlTraverseOptionsInput`: Modify OPTIONS parameters on the traversal.

`@aqlEdgeNode` has no parameters.

**Example**

```graphql
type User {
  friends: [FriendOfEdge!]!
    @aqlEdge(
      collection: "friendOf"
      direction: ANY
      sort: { property: "name", sortOn: "$field_node" }
    )
}

type FriendOfEdge {
  strength: Int
  user: User! @aqlEdgeNode
}
```

#### `@aqlSubquery`

Construct a free-form subquery to resolve a field. There are important rules for your subquery:

- **Important**: You must assign the value you wish to resolve to the `$field` binding. This can be done for a single value using `LET $field = value`, or for a list by ending the subquery with `FOR $field IN list`. See the examples.
- Do not wrap in `()`. This is done by the library.
- Do not include a `RETURN` statement. All `RETURN` projections are constructed by the library for you to match the GraphQL query.

**Parameters**

- `query: String!`: Your subquery string, following the rules listed above.
- `return: String`: An optional way to specify the name of a binding to return. By default, in a subquery, you must follow the important rule marked above and assign to `$field`. However, if you prefer, you may specify which variable binding you want to return within your subquery, and we will do this for you.

**Examples**

_Resolving a single value_

```graphql
type Query {
  userCount: Int!
    @aqlSubquery(
      query: """
      LET $field = LENGTH(users)
      """
    )
}
```

_Resolving multiple values_

```graphql
type Query {
  """
  Merges the list of public posts with the list of posts the user has posted (even
  private) to create a master list of all posts accessible by the user.
  """
  authorizedPosts: [Post!]!
    @aqlSubquery(
      query: """
      LET authenticatedUser = DOCUMENT('users', $context.userId)
      LET allAuthorizedPosts = UNION_DISTINCT(
        (FOR post IN posts FILTER post.public == true RETURN post),
        (FOR post in OUTBOUND authenticatedUser posted RETURN post)
      )
      FOR $field in allAuthorizedPosts
      """
    )
}
```

In the above example, instead of the final line, you could also pass `"allAuthorizedPosts"` to the `return` parameter:

```graphql
type Query {
  """
  Merges the list of public posts with the list of posts the user has posted (even
  private) to create a master list of all posts accessible by the user.
  """
  authorizedPosts: [Post!]!
    @aqlSubquery(
      query: """
      LET authenticatedUser = DOCUMENT('users', $context.userId)
      LET allAuthorizedPosts = UNION_DISTINCT(
        (FOR post IN posts FILTER post.public == true RETURN post),
        (FOR post in OUTBOUND authenticatedUser posted RETURN post)
      )
      """
      return: "allAuthorizedPosts"
    )
}
```

#### `@aql`

Free-form AQL for resolving individual fields using parent data or arbitrary expressions. Unlike `@aqlSubquery`, this should not be used for a full query structure, only for a simple expression.

**Parameters**

- `expression: String!`: The expression to evaluate. Use interpolations to access in-scope information, like the `$parent`.

**Example**

```graphql
type User {
  fullName: String!
    @aql(expression: "CONCAT($parent.firstName, \" \", $parent.lastName)")
}
```

#### `@aqlKey/@aqlId`

Resolve the annotated field with the `_key` or `_id` of the parent document, respectively. You can just attach these to any field which indicates the type's `ID` if you want your GraphQL IDs to be based on the underlying ArangoDB keys or full IDs.

**Example**

```graphql
type User {
  id: ID @aqlKey # will be "2301" or similar
}

type Post {
  id: ID @aqlId # will be "posts/1234" or similar (depending on your collection name)
}
```

### Relay Directives (Experimental)

**Known limitations**

The current Relay directives don't conform entirely to the Relay spec. They only support `first`/`after` paging; no reverse paging. `pageInfo` does not include `hasPreviousPage`. They work for basic, forward-looking pagination use cases, but have not been tested with the official Relay client library.

> The usage of these directives may change a bit over time, so be sure to check when upgrading the library!

You must use all of the provided directives to properly construct a Relay connection, according to the rules below. The following example provides a full picture of how to create a Relay Connection:

**Basic Relay Example**

```graphql
type User {
  postsConnection(first: Int = 10, after: String): UserPostsConnection!
    @aqlRelayConnection(
      edgeCollection: "posted"
      edgeDirection: OUTBOUND
      cursorExpression: "$node.title"
    )
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
  hasNextPage: Boolean!
}

type Post {
  id: ID!
  title: String!
  body: String!
  publishedAt: String!
}
```

**Relay Example with filtering**

```graphql
type User {
  postsConnection(
    first: Int = 10
    after: String
    filter: PostsFilterInput
  ): UserPostsConnection!
    @aqlRelayConnection(
      edgeCollection: "posted"
      edgeDirection: OUTBOUND
      cursorExpression: "$node.title"
      filter: """
      ($args['filter'] && (
        $args['filter'].titleLike == null || LIKE($node.title, CONCAT("%", $args['filter'].titleLike, "%"))
      ) && (
        $args['filter'].publishedAfter == null || $node.publishedAt > $args['filter'].publishedAfter
      ))
      """
    )
}

input PostsFilterInput {
  titleLike: String
  publishedAfter: String
}
```

_About filtering_

- The `filter` parameter must be evaluated as a single boolean expression. Outer parameters should be used to enclose multiple computations.
- If your filter parameter is optional, you should guard against it being `null` within your filter statement.
- The word `filter` is interpreted in AQL as a new `FILTER` statement, so if you use that as a parameter name, you must access it via bracket syntax (`['filter']`), not dot syntax (`.filter`)
- Test that the user has supplied a filterable value before filtering on that value (this is the reason the above example tests that `$args['filter'].titleLike` is not null before asserting that the node title is LIKE that value)
- You may use `$node` and `$edge` to represent the current node and edge you are filtering against. `$edge` is only valid in a true edge connection from a parent node.

All directives can be applied to either the field which is resolved, or the type it resolves to. Applying the directive to the type might be useful if you reuse the connection in multiple places and don't want to apply the directive to each one. However, doing so may make your schema harder to read.

#### `@aqlRelayConnection`

Add this directive to a field _or_ type definition to indicate that it should be resolved as a Relay Connection. The resolved value will have the standard `edges` and `pageInfo` parameters.

> Note: Currently this only supports forward pagination using `after`.

**Parameters**

- `edgeCollection: String`: The name of the collection of edges to traverse
- `edgeDirection: AqlEdgeDirection`: The direction to traverse edges. Can be `ANY`.
- `cursorExpression: String`: An expression used to compute a cursor from a node or edge. Using `$node` will refer to the node, `$edge` refers to the edge. If omitted, entries will be sorted by `_key`.
- `filter: String`: Supply a filter statement to further reduce the edges which will be matched in the connection. `$node`, `$edge`, and `$path` may be used in addition to all standard interpolations, and will correspond to the first, second and third positional bindings in a `FOR ... IN` edge traversal statement.
- `source: String`: (Advanced) Supply your own custom `FOR` expression to source documents from. For example, `FOR $node IN FULLTEXT(Posts, "title", $args.searchTerm)` would create a fulltext search connection. Use `$node` and `$edge` as bindings when traversing documents so that the rest of the query works properly. It's also possible to use subqueries to traverse more advanced collections, like `FOR $node IN (FOR foo IN ...)`. Using a subquery in this way is valid AQL, so you can place any complex traversal logic within it if you wish. Also, if you use `$edge` or `$path` in your `filter` or `cursorExpression` arg, you should be sure to bind them in your `source` arg!

#### `@aqlRelayEdges`

Add this directive to a field _or_ type definition to indicate that it should be resolved as a Relay Edge list. Must be used as a child field of a type resolved by `@aqlRelayConnection`.

#### `@aqlRelayPageInfo`

Add this directive to a field _or_ type definition to indicate that it should be resolved as a Relay Page Info object. Must be used as a child field of a type resolved by `@aqlRelayConnection`.

#### `@aqlRelayNode`

Add this directive to a field _or_ type definition to indicate that it should be resolved as the Node of a Relay Edge. Must be used as a child field of a type resolved by `@aqlRelayEdge`.

### Running Custom Queries (Experimental)

In addition to adding directives to your schema to resolve fields, you can also utilize a function called `runCustomQuery` to imperatively execute AQL queries like you would using the standard `arangojs` client, but with added support for projected return values based on the GraphQL selection!

If that doesn't make sense, imagine a scenario where you are writing a query to do a full text search and you want to pre-process the user's input to work with Lucene. There's not currently a great place to put that processing logic; all the `@aql` directives assume you're just passing in the user's arguments verbatim.

Instead, you can write your own resolver like so:

```ts
import aqlResolver from 'graphql-arangodb';

const searchResolver = async (parent, args, context, info) => {
  const fullTextSearchString = processSearchString(args.searchString);

  return aqlResolver.runCustomQuery({
    queryString: `
    FOR matchedPost IN FULLTEXT(posts, "title", @searchString)
      RETURN matchedPost
    `,
    bindVars: {
      searchString: fullTextSearchString,
    },
    parent,
    context,
    info,
  });
};
```

Here we're using the `aqlResolver.runCustomQuery` function, which accepts a custom query string and bind variables. Write your own AQL however you'd like and return the data to resolve the current field (but be aware that your AQL will be run inside a larger query!).

The magic comes in when the result is returned. Because you passed in the `parent`, `context`, and `info`, `graphql-arangodb` can extend your query to return the rest of the data the user needs for their GraphQL operation. In other words, if the user made the query:

```graphql
query Search($searchString: "good") {
  search(searchString: $searchString) {
    id
    title
    body

    tags {
      id
      name
    }

    author {
      id
      name
    }
  }
}
```

... they would still get `tags` and `author` resolved by your existing `@aql` directives on your schema, at no cost to you.

`runCustomQuery` is a tool to give you as much power as possible to craft root queries and mutations, while still getting the benefits of your declarative directives to resolve deeply nested data in a single database round-trip.

### Mutations (Experimental)

Simple mutations are essentially made possible using the same tools as queries, especially `@aqlSubquery`:

```graphql
type Mutation {
  createPost(input: PostCreateInput!): Post!
    @aqlSubquery(
      query: """
      INSERT { title: $args.input.title, body: $args.input.body } INTO posts
      """
      return: "NEW"
    )
}
```

The user can, of course, make selections on the returned `Post`, which will be properly converted into projections and subqueries just like a query operation.

However, there are some limitations to how complex things can get before you want a proper resolver. If there is logic to be done before writing to the database, you can defer calling `graphql-arangodb`'s resolver until you have done it:

```ts
import { resolver } from 'graphql-arangodb';

const resolvers = {
  Mutation: {
    createPost: async (parent, args, ctx, info) => {
      const canCreatePost = await doSomethingElse(args, ctx);

      if (!canCreatePost) {
        throw new ForbiddenError("Hey, you can't do that!");
      }

      return resolver(parent, args, ctx, info);
    },
  },
};
```

You could also use the same trick to do some logic after.

If you want to modify the arguments before passing them on, or do even more advanced logic, see [the section on `runCustomQuery`](#running-custom-queries-experimental) above.

### Splitting Up Queries (Experimental)

There are notable use cases where you may want to specifically split the overall GraphQL operation into multiple AQL queries. For instance, if you do a write mutation, ArangoDB will not allow you to read from that collection again in the same query. However, it's possible (depending on what you return from your mutation) for the user to create a selection set which re-traverses collections which were affected by the original write. In such a case, you may want to split the initial write AQL query from the subsequent read queries in the remainder of the operation.

You can use the experimental `@aqlNewQuery` directive to do this. Simply add it to any field, and that field will start a brand new AQL query, as if it had been a root field.

**Important:** you must attach the library resolver to any field you annotate with `@aqlNewQuery`, so that it can process that field and any sub-selections into the new AQL query.

**Important:** if you are using this directive to accomplish a read-after-write scenario, you should add the `waitForSync` option to your write queries to ensure the data is consistent before the second query is run.

**Example:**

```graphql
type Post {
  id: ID! @aqlKey
  title: String!
  body: String!
  publishedAt: String!
  author: User! @aqlNode(edgeCollection: "posted", direction: INBOUND)
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
```

The example above allows a user to make a query like this:

```graphql
mutation CreatePost {
  createPost {
    post {
      id
      title
      author {
        id
      }
    }
  }
}
```

without triggering an "access after data-modification by traversal" error from AQL.

Splitting up queries may also be useful for tuning performance and balancing the overall size of queries.

#### Splitting queries on relationships

One interesting property of AQL is that it will interpret a binding parameter which is shaped like a document as a document. This enables you to seamlessly split up fields which traverse edges using `@aqlNewQuery` without any further modifications, because the node from the previous query will be passed into the new query as a `@parent` bind parameter, and all built-in traversal queries are designed to utilize this. In other words, you can add `@aqlNewQuery` to `@aqlNode`, `@aqlEdge`, and `@aqlRelayConnection` without any further changes, and they will function correctly (while splitting into new queries themselves).

In detail: while a typical `@aqlNode` query, for instance, might look like this when generated (much of this is scaffolding from the library, but pay attention to the simplePosts field subquery):

```
LET query = FIRST(
  LET createUser = FIRST(
    INSERT {_key: @userId, role: @role, name: @name} INTO users
    RETURN NEW
  )
  RETURN {
    _id: createUser._id,
    _key: createUser._key,
    _rev: createUser._rev,
    name: createUser.name,
    id: createUser._key,
    simplePosts: (
      FOR createUser_simplePosts IN OUTBOUND createUser posted
      RETURN {
        _id: createUser_simplePosts._id,
        _key: createUser_simplePosts._key,
        _rev: createUser_simplePosts._rev,
        title: createUser_simplePosts.title,
        id: createUser_simplePosts._key
      }
    )
  }
)
RETURN query
```

... if you were to add `@aqlNewQuery` to the `simplePosts` field, it would generate two queries:

```
LET query = FIRST(
  LET createUser = FIRST(
    INSERT {_key: @userId, role: @role, name: @name} INTO users
    RETURN NEW
  )
  RETURN {
    _id: createUser._id,
    _key: createUser._key,
    _rev: createUser._rev,
    name: createUser.name,
    id: createUser._key,
  }
)
RETURN query
```

for the rest of the fields, and then:

```
LET query = FIRST(
  FOR createUser_simplePosts IN OUTBOUND @parent posted
    RETURN {
      _id: createUser_simplePosts._id,
      _key: createUser_simplePosts._key,
      _rev: createUser_simplePosts._rev,
      title: createUser_simplePosts.title,
      id: createUser_simplePosts._key
    }
)
RETURN query
```

for the `simplePosts` field.

The `@parent` bind parameter of the second query will be populated with the returned value from the first query, which includes the needed `_id` field (the library ensures this is always present) for AQL to evaluate the `@parent` bind variable as a document reference.

If you want to expriment with this behavior on your own, try running an AQL query in your database and passing an object with a valid `_id` field as a bind parameter, then traversing edges from it.

---

## Development

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
