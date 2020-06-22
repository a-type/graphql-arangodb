# graphql-arangodb example app

This example assumes you have an ArangoDB instance running on `localhost:8529` that is accessible with the credentials `username:password`.

It also assumes you have a database named `exampleDb`. Set that up if you don't.

Finally, you need these collections:

- `users`
- `posts`

You also need a named graph with edge collections:

- `posted` : from `users`, to `posts`.
- `friendOf`: from `users`, to `users`.

I like [migo](https://github.com/deusdat/arangomigo) as an ArangoDB migration tool. There's migrations for Migo in the `./migrations` directory. You've got to provide the [config](https://github.com/deusdat/arangomigo#creating-the-configuration-file) for your local database server though.

## Playing with the example

Here are some things to try:

```graphql
mutation {
  createExampleUser {
    user {
      name
    }
  }
}
```

```graphql
mutation {
  createPost(title: "Hello world", body: "Hiiii") {
    post {
      id
    }
  }
}
```

```graphql
query {
  users {
    id
    name
    posts {
      id
    }
    drafts {
      id
      title
    }
  }
}
```

The new post will show up in drafts, since it doesn't have a publishedAt field.
