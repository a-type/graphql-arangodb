import { makeExecutableSchema } from 'graphql-tools';
import typeDefs from './fixtures/typeDefs';
import { Database, aql } from 'arangojs';
import { graphql } from 'graphql';
import aqlResolver, { builders } from '..';

describe('query translation integration tests', () => {
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers: {
      Query: {
        user: aqlResolver,
        users: aqlResolver,
        authorizedPosts: aqlResolver,
        posts: async (parent, args, context, info) => {
          if (args.searchTerm) {
            return aqlResolver.runCustomQuery({
              queryBuilder: builders.aqlRelayConnection({
                // this sets up the relay connection to draw from a search view using the requested search term
                source: `FOR $node IN SearchView SEARCH PHRASE($node.name, $args.searchTerm, 'text_en')`,
                // our 'cursor' will actually be the weight value of the result, allowing proper sorting of results by weight.
                cursorExpression: `BM25($node)`,
                // because we order by weight, we actually want to start at higher values and go down
                sortOrder: 'DESC',
              }),
              parent,
              args,
              context,
              info,
            });
          } else {
            return aqlResolver.runCustomQuery({
              queryBuilder: builders.aqlRelayConnection({
                source: `FOR $node IN posts`,
                cursorExpression: '$node.createdAt',
              }),
              parent,
              args,
              context,
              info,
            });
          }
        },
      },
      Mutation: {
        createUser: async (parent: any, args: any, ctx: any, info: any) => {
          const bindVars = {
            userId: 'foobar',
            role: 'captain',
            name: 'Bob',
          };

          return aqlResolver.runCustomQuery({
            query: aql`
              INSERT {_key: ${bindVars.userId}, role: ${bindVars.role}, name: ${bindVars.name}} INTO users
              RETURN NEW
            `,
            parent,
            args,
            context: ctx,
            info,
          });
        },
        createPost: aqlResolver,
      },
      CreatePostPayload: {
        post: aqlResolver,
      },
    },
  });

  const mockRunQuery = jest.fn();

  const mockDb = ({
    query: mockRunQuery,
  } as any) as Database;

  const run = async (
    query: string,
    mockResults: any[],
    contextValue: any = {}
  ) => {
    mockResults.forEach(mockResult => {
      mockRunQuery.mockResolvedValueOnce({
        all: () => Promise.resolve([mockResult]),
      });
    });

    const result = await graphql({
      schema,
      source: query,
      contextValue: {
        arangoContext: contextValue,
        arangoDb: mockDb,
      },
    });

    if (result.errors) {
      throw result.errors[0];
    }

    return result.data;
  };

  test('translates a basic document query', async () => {
    await run(
      `
      query GetUser {
        user(id: "foo") {
          id
          name
          bio
        }
      }
    `,
      [
        {
          id: 'foo',
          name: 'Foo',
          bio: 'No thanks',
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET query = FIRST(
        LET user = DOCUMENT(users, @field_user.args.id)
        RETURN {
          _id: user._id,
          _key: user._key,
          _rev: user._rev,
          name: user.name,
          bio: user.bio,
          id: user._key
        }
      )
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "field_user": Object {
          "args": Object {
            "id": "foo",
          },
        },
      }
    `);
  });

  test('translates a document with a nested node', async () => {
    await run(
      `
      query GetUserAndPosts {
        user(id: "foo") {
          id
          name

          simplePosts {
            id
            title
          }
        }
      }
      `,
      [
        {
          id: 'foo',
          name: 'Foo',
          simplePosts: [
            {
              id: 'a',
              title: 'Hello world',
            },
            {
              id: 'b',
              title: 'Hello again world',
            },
            {
              id: 'c',
              title: 'Come here often, world?',
            },
          ],
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET query = FIRST(
        LET user = DOCUMENT(users, @field_user.args.id)
        RETURN {
          _id: user._id,
          _key: user._key,
          _rev: user._rev,
          name: user.name,
          id: user._key,
          simplePosts: (
            FOR user_simplePosts IN OUTBOUND user posted
            RETURN {
              _id: user_simplePosts._id,
              _key: user_simplePosts._key,
              _rev: user_simplePosts._rev,
              title: user_simplePosts.title,
              id: user_simplePosts._key
            }
          )
        }
      )
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "field_user": Object {
          "args": Object {
            "id": "foo",
          },
        },
      }
    `);
  });

  test('filters', async () => {
    await run(
      `
      query GetUserAndFilteredPosts {
        user(id: "foo") {
          id

          filteredPosts(titleMatch: "here") {
            id
            title
          }
        }
      }
      `,
      [
        {
          id: 'foo',
          filteredPosts: [
            {
              id: 'c',
              title: 'Come here often, world?',
            },
          ],
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET query = FIRST(
        LET user = DOCUMENT(users, @field_user.args.id)
        RETURN {
          _id: user._id,
          _key: user._key,
          _rev: user._rev,
          id: user._key,
          filteredPosts: (
            FOR user_filteredPosts IN OUTBOUND user posted
              FILTER user_filteredPosts.title =~ @field_user_filteredPosts.args.titleMatch
            RETURN {
              _id: user_filteredPosts._id,
              _key: user_filteredPosts._key,
              _rev: user_filteredPosts._rev,
              title: user_filteredPosts.title,
              id: user_filteredPosts._key
            }
          )
        }
      )
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "field_user": Object {
          "args": Object {
            "id": "foo",
          },
        },
        "field_user_filteredPosts": Object {
          "args": Object {
            "titleMatch": "here",
          },
        },
      }
    `);
  });

  test('paginates', async () => {
    await run(
      `
      query GetUserAndPaginatedPosts {
        user(id: "foo") {
          id

          paginatedPosts(count: 2) {
            id
            title
          }
        }
      }
      `,
      [
        {
          id: 'foo',
          paginatedPosts: [
            {
              id: 'b',
              title: 'Hello again world',
            },
            {
              id: 'c',
              title: 'Come here often, world?',
            },
          ],
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET query = FIRST(
        LET user = DOCUMENT(users, @field_user.args.id)
        RETURN {
          _id: user._id,
          _key: user._key,
          _rev: user._rev,
          id: user._key,
          paginatedPosts: (
            FOR user_paginatedPosts IN OUTBOUND user posted
              SORT user_paginatedPosts[@field_user_paginatedPosts.args.sort] ASC
              LIMIT @field_user_paginatedPosts.args.skip @field_user_paginatedPosts.args.count
            RETURN {
              _id: user_paginatedPosts._id,
              _key: user_paginatedPosts._key,
              _rev: user_paginatedPosts._rev,
              title: user_paginatedPosts.title,
              id: user_paginatedPosts._key
            }
          )
        }
      )
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "field_user": Object {
          "args": Object {
            "id": "foo",
          },
        },
        "field_user_paginatedPosts": Object {
          "args": Object {
            "count": 2,
            "skip": 0,
            "sort": "title",
          },
        },
      }
    `);
  });

  test('sorts descending', async () => {
    await run(
      `
      query GetUserAndDescendingPosts {
        user(id: "foo") {
          id

          descendingPosts {
            id
            title
          }
        }
      }
      `,
      [
        {
          id: 'foo',
          descendingPosts: [
            {
              id: 'b',
              title: 'Hello again world',
            },
            {
              id: 'c',
              title: 'Come here often, world?',
            },
          ],
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET query = FIRST(
        LET user = DOCUMENT(users, @field_user.args.id)
        RETURN {
          _id: user._id,
          _key: user._key,
          _rev: user._rev,
          id: user._key,
          descendingPosts: (
            FOR user_descendingPosts IN OUTBOUND user posted
              SORT user_descendingPosts[\\"title\\"] DESC
            RETURN {
              _id: user_descendingPosts._id,
              _key: user_descendingPosts._key,
              _rev: user_descendingPosts._rev,
              title: user_descendingPosts.title,
              id: user_descendingPosts._key
            }
          )
        }
      )
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "field_user": Object {
          "args": Object {
            "id": "foo",
          },
        },
      }
    `);
  });

  test('traverses edges', async () => {
    await run(
      `
      query GetUserAndFriends {
        user(id: "foo") {
          id
          name

          friends {
            strength

            user {
              id
              name
            }
          }
        }
      }
      `,
      [
        {
          id: 'foo',
          name: 'Bar',
          friends: [
            {
              strength: 2,
              user: {
                id: 'bar',
                name: 'Jeff',
              },
            },
          ],
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET query = FIRST(
        LET user = DOCUMENT(users, @field_user.args.id)
        RETURN {
          _id: user._id,
          _key: user._key,
          _rev: user._rev,
          name: user.name,
          id: user._key,
          friends: (
            FOR user_friends_node, user_friends IN ANY user friendOf
            RETURN {
              _id: user_friends._id,
              _key: user_friends._key,
              _rev: user_friends._rev,
              strength: user_friends.strength,
              user: user_friends_node
            }
          )
        }
      )
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "field_user": Object {
          "args": Object {
            "id": "foo",
          },
        },
      }
    `);
  });

  test('runs arbitrary subqueries', async () => {
    await run(
      `
      query GetUserAndFriends {
        user(id: "foo") {
          id
          name

          friendsOfFriends {
            id
            name
          }
        }
      }
      `,
      [
        {
          id: 'foo',
          name: 'Bar',
          friendsOfFriends: [
            {
              id: 'baz',
              name: 'Eva',
            },
          ],
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET query = FIRST(
        LET user = DOCUMENT(users, @field_user.args.id)
        RETURN {
          _id: user._id,
          _key: user._key,
          _rev: user._rev,
          name: user.name,
          id: user._key,
          friendsOfFriends: (
            FOR user_friendsOfFriends IN 2..2 ANY user friendOf OPTIONS {bfs: true, uniqueVertices: 'path'}
            RETURN {
              _id: user_friendsOfFriends._id,
              _key: user_friendsOfFriends._key,
              _rev: user_friendsOfFriends._rev,
              name: user_friendsOfFriends.name,
              id: user_friendsOfFriends._key
            }
          )
        }
      )
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "field_user": Object {
          "args": Object {
            "id": "foo",
          },
        },
      }
    `);
  });

  test('uses context values', async () => {
    await run(
      `
      query GetAuthorizedPosts {
        authorizedPosts {
          id
          title
        }
      }
      `,
      [
        [
          {
            id: 'a',
            title: 'Hello world',
          },
          {
            id: 'b',
            title: 'Hello again world',
          },
        ],
      ],
      {
        userId: 'foo',
      }
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET query = (
        LET authenticatedUser = DOCUMENT('users', @context.userId)
        LET allAuthorizedPosts = UNION_DISTINCT(
          (FOR post IN posts FILTER post.public == true RETURN post),
          (FOR post IN OUTBOUND authenticatedUser posted RETURN post)
        )
        FOR authorizedPosts IN allAuthorizedPosts
        RETURN {
          _id: authorizedPosts._id,
          _key: authorizedPosts._key,
          _rev: authorizedPosts._rev,
          title: authorizedPosts.title,
          id: authorizedPosts._key
        }
      )
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "context": Object {
          "userId": "foo",
        },
      }
    `);
  });

  test('runs aql expressions', async () => {
    await run(
      `
      query GetUserAndFriends {
        user(id: "foo") {
          id

          fullName
        }
      }
      `,
      [
        {
          id: 'foo',
          fullName: 'Foo Bar',
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET query = FIRST(
        LET user = DOCUMENT(users, @field_user.args.id)
        RETURN {
          _id: user._id,
          _key: user._key,
          _rev: user._rev,
          id: user._key,
          fullName: CONCAT(user.name, \\" \\", user.surname)
        }
      )
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "field_user": Object {
          "args": Object {
            "id": "foo",
          },
        },
      }
    `);
  });

  test('does a Relay-style connection', async () => {
    await run(
      `
      query GetUser {
        user(id: "foo") {
          id

          postsConnection(after: "opaqueCursor", filter: { publishedAfter: "2019-17-08 04:27:54 AM" }) {
            edges {
              cursor
              node {
                id
                title
              }
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      }
    `,
      [
        {
          id: 'foo',

          postsConnection: {
            edges: [
              {
                cursor: 'a',
                node: {
                  id: 'a',
                  title: 'Hello world',
                },
              },
            ],
            pageInfo: {
              hasNextPage: false,
            },
          },
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET query = FIRST(
        LET user = DOCUMENT(users, @field_user.args.id)
        RETURN {
          _id: user._id,
          _key: user._key,
          _rev: user._rev,
          id: user._key,
          postsConnection: FIRST(
            LET user_postsConnection_listPlusOne = (
              FOR user_postsConnection_node, user_postsConnection_edge IN OUTBOUND user posted
                OPTIONS {bfs: true}
              FILTER user_postsConnection_node && (!@field_user_postsConnection.args.after || user_postsConnection_node.title > @field_user_postsConnection.args.after) && (
                @field_user_postsConnection.args['filter'] != null && (
                  @field_user_postsConnection.args['filter'].publishedAfter == null || user_postsConnection_node.publishedAt > @field_user_postsConnection.args['filter'].publishedAfter
                ) && (
                  @field_user_postsConnection.args['filter'].titleLike == null || LIKE(user_postsConnection_node.title, CONCAT(\\"%\\", @field_user_postsConnection.args['filter'].titleLike, \\"%\\"))
                )
              )
              SORT user_postsConnection_node.title ASC
              LIMIT @field_user_postsConnection.args.first + 1
              RETURN MERGE(user_postsConnection_edge, { cursor: user_postsConnection_node.title, node: user_postsConnection_node })
            )
            LET user_postsConnection_pruned_edges = SLICE(user_postsConnection_listPlusOne, 0, @field_user_postsConnection.args.first)
            LET user_postsConnection = {
              edges: user_postsConnection_pruned_edges,
              pageInfo: { 
                hasNextPage: LENGTH(user_postsConnection_listPlusOne) == @field_user_postsConnection.args.first + 1,
                startCursor: LENGTH(user_postsConnection_pruned_edges) > 0 ? FIRST(user_postsConnection_pruned_edges).cursor : null,
                endCursor: LENGTH(user_postsConnection_pruned_edges) > 0 ? LAST(user_postsConnection_pruned_edges).cursor : null
              }
            }
            RETURN {
              _id: user_postsConnection._id,
              _key: user_postsConnection._key,
              _rev: user_postsConnection._rev,
              edges: (
                FOR user_postsConnection_edges IN user_postsConnection.edges
                RETURN {
                  _id: user_postsConnection_edges._id,
                  _key: user_postsConnection_edges._key,
                  _rev: user_postsConnection_edges._rev,
                  cursor: user_postsConnection_edges.cursor,
                  node: FIRST(
                    LET user_postsConnection_edges_node = user_postsConnection_edges.node
                    RETURN {
                      _id: user_postsConnection_edges_node._id,
                      _key: user_postsConnection_edges_node._key,
                      _rev: user_postsConnection_edges_node._rev,
                      title: user_postsConnection_edges_node.title,
                      id: user_postsConnection_edges_node._key
                    }
                  )
                }
              ),
              pageInfo: FIRST(
                LET user_postsConnection_pageInfo = user_postsConnection.pageInfo
                RETURN {
                  _id: user_postsConnection_pageInfo._id,
                  _key: user_postsConnection_pageInfo._key,
                  _rev: user_postsConnection_pageInfo._rev,
                  hasNextPage: user_postsConnection_pageInfo.hasNextPage
                }
              )
            }
          )
        }
      )
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "field_user": Object {
          "args": Object {
            "id": "foo",
          },
        },
        "field_user_postsConnection": Object {
          "args": Object {
            "after": "opaqueCursor",
            "filter": Object {
              "publishedAfter": "2019-17-08 04:27:54 AM",
            },
            "first": 10,
          },
        },
      }
    `);
  });

  test('passes traversal options', async () => {
    await run(
      `
      query GetUserAndPosts {
        user(id: "foo") {
          id
          name

          bfsPosts {
            id
            title
          }
        }
      }
      `,
      [
        {
          id: 'foo',
          name: 'Foo',
          bfsPosts: [
            {
              id: 'a',
              title: 'Hello world',
            },
            {
              id: 'b',
              title: 'Hello again world',
            },
            {
              id: 'c',
              title: 'Come here often, world?',
            },
          ],
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET query = FIRST(
        LET user = DOCUMENT(users, @field_user.args.id)
        RETURN {
          _id: user._id,
          _key: user._key,
          _rev: user._rev,
          name: user.name,
          id: user._key,
          bfsPosts: (
            FOR user_bfsPosts IN OUTBOUND user posted
              OPTIONS { bfs: true }
            RETURN {
              _id: user_bfsPosts._id,
              _key: user_bfsPosts._key,
              _rev: user_bfsPosts._rev,
              title: user_bfsPosts.title,
              id: user_bfsPosts._key
            }
          )
        }
      )
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "field_user": Object {
          "args": Object {
            "id": "foo",
          },
        },
      }
    `);
  });

  test('resolves a custom query inside the resolver with selections', async () => {
    await run(
      `
      mutation CreateUser {
        createUser {
          id
          name

          simplePosts {
            id
            title
          }
        }
      }
      `,
      [
        {
          id: 'foobar',
          name: 'Bob',
          simplePosts: [],
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET query = FIRST(
        LET createUser = FIRST(
          
                        INSERT {_key: @value0, role: @value1, name: @value2} INTO users
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
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "value0": "foobar",
        "value1": "captain",
        "value2": "Bob",
      }
    `);
  });

  test('resolves a custom builder-based query with conditional behavior', async () => {
    await run(
      `
      query SearchPosts {
        posts(searchTerm: "foo") {
          edges {
            node {
              id
              title
            }
          }
        }
      }
      `,
      [
        {
          edges: [
            {
              node: {
                id: 'a',
                title: 'foo',
              },
            },
            {
              node: {
                id: 'b',
                title: 'foobar',
              },
            },
          ],
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET query = FIRST(
        LET posts_listPlusOne = (
          FOR posts_node IN SearchView SEARCH PHRASE(posts_node.name, @field_posts.args.searchTerm, 'text_en')
          FILTER (!@field_posts.args.after || BM25(posts_node) > @field_posts.args.after) && true
          SORT BM25(posts_node) DESC
          LIMIT @field_posts.args.first + 1
          RETURN { cursor: BM25(posts_node), node: posts_node }
        )
        LET posts_pruned_edges = SLICE(posts_listPlusOne, 0, @field_posts.args.first)
        LET posts = {
          edges: posts_pruned_edges,
          pageInfo: { 
            hasNextPage: LENGTH(posts_listPlusOne) == @field_posts.args.first + 1,
            startCursor: LENGTH(posts_pruned_edges) > 0 ? FIRST(posts_pruned_edges).cursor : null,
            endCursor: LENGTH(posts_pruned_edges) > 0 ? LAST(posts_pruned_edges).cursor : null
          }
        }
        RETURN {
          _id: posts._id,
          _key: posts._key,
          _rev: posts._rev,
          edges: (
            FOR posts_edges IN posts.edges
            RETURN {
              _id: posts_edges._id,
              _key: posts_edges._key,
              _rev: posts_edges._rev,
              node: FIRST(
                LET posts_edges_node = posts_edges.node
                RETURN {
                  _id: posts_edges_node._id,
                  _key: posts_edges_node._key,
                  _rev: posts_edges_node._rev,
                  title: posts_edges_node.title,
                  id: posts_edges_node._key
                }
              )
            }
          )
        }
      )
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "field_posts": Object {
          "args": Object {
            "first": 10,
            "searchTerm": "foo",
          },
        },
      }
    `);

    await run(
      `
      query SearchPosts {
        posts {
          edges {
            node {
              id
              title
            }
          }
        }
      }
      `,
      [
        {
          edges: [
            {
              node: {
                id: 'c',
                title: 'baz',
              },
            },
            {
              node: {
                id: 'd',
                title: 'bop',
              },
            },
          ],
        },
      ]
    );

    expect(mockRunQuery.mock.calls[1][0].query).toMatchInlineSnapshot(`
      "LET query = FIRST(
        LET posts_listPlusOne = (
          FOR posts_node IN posts
          FILTER (!@field_posts.args.after || posts_node.createdAt > @field_posts.args.after) && true
          SORT posts_node.createdAt ASC
          LIMIT @field_posts.args.first + 1
          RETURN { cursor: posts_node.createdAt, node: posts_node }
        )
        LET posts_pruned_edges = SLICE(posts_listPlusOne, 0, @field_posts.args.first)
        LET posts = {
          edges: posts_pruned_edges,
          pageInfo: { 
            hasNextPage: LENGTH(posts_listPlusOne) == @field_posts.args.first + 1,
            startCursor: LENGTH(posts_pruned_edges) > 0 ? FIRST(posts_pruned_edges).cursor : null,
            endCursor: LENGTH(posts_pruned_edges) > 0 ? LAST(posts_pruned_edges).cursor : null
          }
        }
        RETURN {
          _id: posts._id,
          _key: posts._key,
          _rev: posts._rev,
          edges: (
            FOR posts_edges IN posts.edges
            RETURN {
              _id: posts_edges._id,
              _key: posts_edges._key,
              _rev: posts_edges._rev,
              node: FIRST(
                LET posts_edges_node = posts_edges.node
                RETURN {
                  _id: posts_edges_node._id,
                  _key: posts_edges_node._key,
                  _rev: posts_edges_node._rev,
                  title: posts_edges_node.title,
                  id: posts_edges_node._key
                }
              )
            }
          )
        }
      )
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[1][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "field_posts": Object {
          "args": Object {
            "first": 10,
          },
        },
      }
    `);
  });

  test('resolves multi-query operations to avoid read-after-write errors', async () => {
    const result = await run(
      `
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
      `,
      [
        {
          postId: '3',
        },
        {
          id: '3',
          title: 'Fake post',
          author: {
            id: 'foo',
          },
        },
      ]
    );

    expect(result).toEqual({
      createPost: {
        post: {
          id: '3',
          title: 'Fake post',
          author: {
            id: 'foo',
          },
        },
      },
    });

    expect(mockRunQuery).toHaveBeenCalledTimes(2);
    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET query = FIRST(
        INSERT { title: \\"Fake post\\", body: \\"foo\\", publishedAt: \\"2019-05-03\\" }
        INTO posts
        OPTIONS { waitForSync: true }
        LET createPost = {
          post: NEW
        }
        RETURN {
          _id: createPost._id,
          _key: createPost._key,
          _rev: createPost._rev,
          post: createPost.post
        }
      )
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(
      `Object {}`
    );
    expect(mockRunQuery.mock.calls[1][0].query).toMatchInlineSnapshot(`
      "LET query = FIRST(
        LET post = DOCUMENT(posts, @parent._key)
        RETURN {
          _id: post._id,
          _key: post._key,
          _rev: post._rev,
          title: post.title,
          id: post._key,
          author: FIRST(
            FOR post_author IN INBOUND post posted
              LIMIT 1
            RETURN {
              _id: post_author._id,
              _key: post_author._key,
              _rev: post_author._rev,
              id: post_author._key
            }
          )
        }
      )
      RETURN query"
    `);
    expect(mockRunQuery.mock.calls[1][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "parent": Object {
          "postId": "3",
        },
      }
    `);
  });
});
