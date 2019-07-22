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
    - [Interpolations](#interpolations)
    - [Directives](#directives)
      - [Enums](#enums)
      - [`@document`](#document)
      - [`@node`](#node)
      - [`@edge/@edgeNode`](#edgeedgenode)
      - [`@filter`](#filter)
      - [`@sort`](#sort)
      - [`@limit`](#limit)
      - [`@subquery`](#subquery)
      - [`@aql`](#aql)
      - [`@key`](#key)
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

For most people, adding the default `resolver` from `graphql-arangodb` should be enough:

```ts
import { resolver } from 'graphql-arangodb';

const resolvers = {
  Query: {
    user: resolver,
    users: resolver,
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

The following directives are supported out of the box:

- `@document`: Selects a single document by ID or multiple documents from a collection
- `@node`: Traverses an edge to another node from a parent document
- `@edge`: Traverses an edge from a parent document, returning the edge itself
- `@edgeNode`: Completes an `@edge` traversal, referencing the node at the other end
- `@filter`: Adds a `FILTER` clause to a field
- `@limit`: Adds a `LIMIT` clause to a field
- `@sort`: Adds a `SORT` clause to a field
- `@subquery`: Craft your own sub-query in AQL to resolve a field
- `@aql`: An all-purpose directive for free-form field resolution using AQL. Unlike `@subquery`, it's used to just compute a single expression without a sub-query.

Usage of these directives is fairly similar to writing subqueries directly in AQL. The main thing to know is that you never write the `RETURN` statement. This library automatically constructs the correct `RETURN` projections based on the selected fields in the GraphQL query.

### Interpolations

All directives support the following interpolations in their parameter values:

- `$parent`: Reference the parent document. If there is no parent (this is a root field in the query), references the `parent` from GraphQL, if that exists.
- `$field`: Reference the field itself. In `@aql` directives, you must assign something to this binding to be returned as the value of the field. For all other purposes, you can use this to reference the current value (for instance, if you want to do a filter on `$field.name` or some other property).
- `$args`: Reference the field args of the GraphQL query. You can use nested arg values. Usages of `$args` get turned into bind variables when the query is executed, and all field args are passed in as values.
- `$context`: Reference values from the `arangoContext` key in your GraphQL context. Use this for global values across all queries, like the authenticated user ID.

### Directives

#### Enums

Before we begin with the directives, this library also ships some enums which will be used in directive parameters. To use an enum, just supply its literal value to the parameter (don't enclose it in `"` marks).

- `AqlEdgeDirection`: `OUTBOUND | INBOUND | ANY`
- `AqlSortOrder`: `DESC | ASC`

#### `@document`

Selects a single or multiple documents (depending on whether the return type of the field is a list) from a specified collection. If a single document is selected, you can supply an `key` parameter to select it directly. This `key` parameter may be an argument interpolation (`$args.id`, etc), or a concrete value. It is passed directly into the `DOCUMENT` AQL function as the second parameter. If you do not specify an `key` parameter, the first item from the collection will be returned. To select a single item with a filter, use `@aql`.

**Parameters**

- `collection: String!`: The name of the collection of documents
- `key: String`: A string value or interpolation that indicates the database key of the document.

**Example**

```graphql
type Query {
  user(id: ID!): User
    @document(
      collection: "users"
      key: "$args.id"
    )
}
```

#### `@node`

Traverses a relationship from the parent document to another document across an edge. `@node` skips over the edge and returns the related document as the field value. If you want to utilize properties from the edge, use `@edge/@edgeNode` instead.

**Parameters**

- `edgeCollection: String!`: The name of the collection which the edge belongs to
- `direction: AqlEdgeDirection!`: The direction to traverse. Can be `ANY`.

**Example**

```graphql
type User {
  posts: [Post!]!
    @node(
      edgeCollection: "posted"
      direction: OUTBOUND
    )
}
```

#### `@edge/@edgeNode`

`@edge` traverses an edge from the parent document, returning the edge itself as the field value. `@edgeNode` can be used on the type which represents the edge to reference the document at the other end of it. `@edgeNode` should only be used on a field within a type represented by an edge. It has no directive parameters.

**Parameters**

Only `@edge` takes parameters:

- `collection: String!`: The name of the collection for the edge
- `direction: AqlEdgeDirection!`: The direction to traverse. Can be `ANY`.

`@edgeNode` has no parameters.

**Example**

```graphql
type User {
  friends: [FriendOfEdge!]!
    @edge(
      collection: "friendOf"
      direction: ANY
    )
}

type FriendOfEdge {
  strength: Int
  user: User! @edgeNode
}
```

#### `@filter`

A complementary directive to `@document`, `@node`, or `@edge`. Adds a `FILTER` statement to refine results. As always, you can use interpolations to filter based on field parameters. `$field` is particularly helpful, as you will need it to filter based on the properties of each document checked (see example).

**Parameters**

- `statement: String!`: Basically, everything to the right of `FILTER`.

**Example**

```graphql
type User {
  posts(titleMatch: String): [Post!]!
    @node(edgeCollection: "posted", direction: OUTBOUND)
    @filter(statement: "$args.titleMatch == null || $field.title =~ $args.titleMatch")
}
```

#### `@sort`

A complementary directive to `@document`, `@node`, or `@edge`. Adds a `SORT` statement to order results.

**Parameters**

- `property: String!`: A property on the field to sort based on. The property name alone should be supplied (adding `$field.` is not necessary)
- `order: AqlSortOrder!`: The order to sort by.

**Example**

```graphql
type Query {
  users: [User!]!
    @document(collection: "users")
    @sort(property: "name", direction: ASC)
}
```

#### `@limit`

A complementary directive to `@document`, `@node`, or `@edge`. Adds a `LIMIT` statement to paginate results.

**Parameters**

- `count: String!` A value or interpolation which indicates how many documents to return.
- `skip: String`: A value or interpolation which indicates an initial skip count.

**Example**

```graphql
type Query {
  users(count: String!, skip: String = 0): [User!]!
    @document(collection: "users")
    @limit(count: "$args.count", skip: "$args.skip")
}
```

#### `@subquery`

Construct a free-form subquery to resolve a field. There are important rules for your subquery:

- **Important**: You must assign the value you wish to resolve to the `$field` binding. This can be done for a single value using `LET $field = value`, or for a list by ending the subquery with `FOR $field IN list`. See the examples.
- Do not wrap in `()`. This is done by the library.
- Do not include a `RETURN` statement. All `RETURN` projections are constructed by the library for you to match the GraphQL query.

**Parameters**

- `query: String!`: Your subquery string, following the rules listed above.

**Examples**

_Resolving a single value_

```graphql
type Query {
  userCount: Int!
    @subquery(
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
    @subquery(
      query: """
      LET authenticatedUser = DOCUMENT('users', $context.userId)
      LET allAuthorizedPOoss = UNION_DISTINCT(
        (FOR post IN posts FILTER post.public == true RETURN post),
        (FOR post in OUTBOUND authenticatedUser posted RETURN post)
      )
      FOR $field in allAuthorizedPosts
      """
    )
}
```

#### `@aql`

Free-form AQL for resolving individual fields using parent data or arbitrary expressions. Unlike `@subquery`, this should not be used for a full query structure, only for a simple expression.

**Parameters**

- `expression: String!`: The expression to evaluate. Use interpolations to access in-scope information, like the `$parent`.

**Example**

```graphql
type User {
  fullName: String!
    @aql(expression: "CONCAT($parent.firstName, \" \", $parent.lastName)")
}
```

#### `@key`

Resolves the annotated field with the `_key` of the parent document. You can just attach this to any field which indicates the type's `ID` if you want your GraphQL IDs to be based on the underlying ArangoDB keys.

**Example**

```graphql
type User {
  id: @key
}
```

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
