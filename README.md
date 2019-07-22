# graphql-arangodb

An experimental library for 'translating' GraphQL operations into ArangoDB AQL queries which are designed to fetch all requested data in as few queries as possible. Flexibility is another objective; I want to empower the developer to define exactly how they want their GraphQL schema without being forced into a particular schema shape due to their database structure.

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
- `@aql`: An all-purpose subquery directive for free-form AQL

Usage of these directives is fairly similar to writing subqueries directly in AQL. The main thing to know is that you never write the `RETURN` statement. This library automatically constructs the correct `RETURN` projections based on the selected fields in the GraphQL query.

### Interpolations

All directives support the following interpolations in their parameter values:

- `$parent`: Reference the parent document. If there is no parent (this is a root field in the query), references the `parent` from GraphQL, if that exists.
- `$field`: Reference the field itself. In `@aql` directives, you must assign something to this binding to be returned as the value of the field. For all other purposes, you can use this to reference the current value (for instance, if you want to do a filter on `$field.name` or some other property).
- `$args`: Reference the field args of the GraphQL query. You can use nested arg values. Usages of `$args` get turned into bind variables when the query is executed, and all field args are passed in as values.
- `$context`: Reference values from the `arangoContext` key in your GraphQL context. Use this for global values across all queries, like the authenticated user ID.

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
