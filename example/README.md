# graphql-arangodb example app

This example assumes you have an ArangoDB instance running on `localhost:8529` that is accessible with the credentials `username:password`.

It also assumes you have a database named `exampleDb`. Set that up if you don't.

Finally, you need these collections:

- `users`
- `posts`

You also need a named graph with edge collections:

- `posted` : from `users`, to `posts`.
- `friendOf`: from `users`, to `users`.

I like [migo](https://github.com/deusdat/arangomigo) as an ArangoDB migration tool. In Migo, the above might look like:

**0001_database.migration**

```yml
type: database
action: create
name: exampleDb
allowed:
  - username: username
  - password: password
```

**0002_users.migration**

```yml
type: collection
action: create
name: users
```

**0003_posts.migration**

```yml
type: collection
action: create
name: posts
```

**0004_graph.migration**

```yml
type: graph
action: create
name: main_graph
edgedefinitions:
  - collection: posted
    from:
      - users
    to:
      - posts
  - collection: friendOf
    from:
      - users
    to:
      - users
```
