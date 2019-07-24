import { makeExecutableSchema } from 'graphql-tools';
import typeDefs from './fixtures/typeDefs';
import { Database } from 'arangojs';
import { graphql } from 'graphql';
import { resolver } from '../resolver';

describe('query translation integration tests', () => {
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers: {
      Query: {
        user: resolver,
        users: resolver,
        authorizedPosts: resolver,
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
        all: () =>
          Promise.resolve(
            mockResult instanceof Array ? mockResult : [mockResult]
          ),
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
          user: {
            id: 'foo',
            name: 'Foo',
            bio: 'No thanks',
          },
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
                                    "LET user = DOCUMENT(users, @field_user.args.id)
                                    RETURN {
                                      name: user.name,
                                      bio: user.bio
                                      id: FIRST(
                                        LET user_id = user._key
                                        RETURN user_id
                                      )
                                    }"
                        `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
                                                                                    Object {
                                                                                      "context": Object {},
                                                                                      "field_user": Object {
                                                                                        "args": Object {
                                                                                          "id": "foo",
                                                                                        },
                                                                                      },
                                                                                      "field_user_id": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "parent": undefined,
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
          user: {
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
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
                                    "LET user = DOCUMENT(users, @field_user.args.id)
                                    RETURN {
                                      name: user.name
                                      id: FIRST(
                                        LET user_id = user._key
                                        RETURN user_id
                                      ),
                                      simplePosts: (
                                        FOR user_simplePosts IN OUTBOUND user posted
                                        RETURN {
                                          title: user_simplePosts.title
                                          id: FIRST(
                                            LET user_simplePosts_id = user_simplePosts._key
                                            RETURN user_simplePosts_id
                                          )
                                        }
                                      )
                                    }"
                        `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
                                                                                    Object {
                                                                                      "context": Object {},
                                                                                      "field_user": Object {
                                                                                        "args": Object {
                                                                                          "id": "foo",
                                                                                        },
                                                                                      },
                                                                                      "field_user_id": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "field_user_simplePosts": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "field_user_simplePosts_id": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "parent": undefined,
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
          user: {
            id: 'foo',
            filteredPosts: [
              {
                id: 'c',
                title: 'Come here often, world?',
              },
            ],
          },
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET user = DOCUMENT(users, @field_user.args.id)
      RETURN {
        id: FIRST(
          LET user_id = user._key
          RETURN user_id
        ),
        filteredPosts: (
          FOR user_filteredPosts IN OUTBOUND user posted
            FILTER user_filteredPosts.title =~ @field_user_filteredPosts.args.titleMatch
          RETURN {
            title: user_filteredPosts.title
            id: FIRST(
              LET user_filteredPosts_id = user_filteredPosts._key
              RETURN user_filteredPosts_id
            )
          }
        )
      }"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
                                                                                    Object {
                                                                                      "context": Object {},
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
                                                                                      "field_user_filteredPosts_id": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "field_user_id": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "parent": undefined,
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
          user: {
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
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET user = DOCUMENT(users, @field_user.args.id)
      RETURN {
        id: FIRST(
          LET user_id = user._key
          RETURN user_id
        ),
        paginatedPosts: (
          FOR user_paginatedPosts IN OUTBOUND user posted
            SORT user_paginatedPosts[@field_user_paginatedPosts.args.sort] ASC
            LIMIT @field_user_paginatedPosts.args.skip @field_user_paginatedPosts.args.count
          RETURN {
            title: user_paginatedPosts.title
            id: FIRST(
              LET user_paginatedPosts_id = user_paginatedPosts._key
              RETURN user_paginatedPosts_id
            )
          }
        )
      }"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "context": Object {},
        "field_user": Object {
          "args": Object {
            "id": "foo",
          },
        },
        "field_user_id": Object {
          "args": undefined,
        },
        "field_user_paginatedPosts": Object {
          "args": Object {
            "count": 2,
            "skip": 0,
            "sort": "title",
          },
        },
        "field_user_paginatedPosts_id": Object {
          "args": undefined,
        },
        "parent": undefined,
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
          user: {
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
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET user = DOCUMENT(users, @field_user.args.id)
      RETURN {
        id: FIRST(
          LET user_id = user._key
          RETURN user_id
        ),
        descendingPosts: (
          FOR user_descendingPosts IN OUTBOUND user posted
            SORT user_descendingPosts[\\"title\\"] DESC
          RETURN {
            title: user_descendingPosts.title
            id: FIRST(
              LET user_descendingPosts_id = user_descendingPosts._key
              RETURN user_descendingPosts_id
            )
          }
        )
      }"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
                                                                                    Object {
                                                                                      "context": Object {},
                                                                                      "field_user": Object {
                                                                                        "args": Object {
                                                                                          "id": "foo",
                                                                                        },
                                                                                      },
                                                                                      "field_user_descendingPosts": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "field_user_descendingPosts_id": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "field_user_id": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "parent": undefined,
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
          user: {
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
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
      "LET user = DOCUMENT(users, @field_user.args.id)
      RETURN {
        name: user.name
        id: FIRST(
          LET user_id = user._key
          RETURN user_id
        ),
        friends: (
          FOR user_friends_node, user_friends IN ANY user friendOf
          RETURN {
            strength: user_friends.strength
            user: FIRST(
              LET user_friends_user = user_friends_node
              RETURN {
                name: user_friends_user.name
                id: FIRST(
                  LET user_friends_user_id = user_friends_user._key
                  RETURN user_friends_user_id
                )
              }
            )
          }
        )
      }"
    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
                                                                                    Object {
                                                                                      "context": Object {},
                                                                                      "field_user": Object {
                                                                                        "args": Object {
                                                                                          "id": "foo",
                                                                                        },
                                                                                      },
                                                                                      "field_user_friends": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "field_user_friends_user": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "field_user_friends_user_id": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "field_user_id": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "parent": undefined,
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
          user: {
            id: 'foo',
            name: 'Bar',
            friendsOfFriends: [
              {
                id: 'baz',
                name: 'Eva',
              },
            ],
          },
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
                              "LET user = DOCUMENT(users, @field_user.args.id)
                              RETURN {
                                name: user.name
                                id: FIRST(
                                  LET user_id = user._key
                                  RETURN user_id
                                ),
                                friendsOfFriends: (
                                  FOR user_friendsOfFriends IN 2..2 ANY user friendOf OPTIONS {bfs: true, uniqueVertices: 'path'}
                                  RETURN {
                                    name: user_friendsOfFriends.name
                                    id: FIRST(
                                      LET user_friendsOfFriends_id = user_friendsOfFriends._key
                                      RETURN user_friendsOfFriends_id
                                    )
                                  }
                                )
                              }"
                    `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
                                                                                    Object {
                                                                                      "context": Object {},
                                                                                      "field_user": Object {
                                                                                        "args": Object {
                                                                                          "id": "foo",
                                                                                        },
                                                                                      },
                                                                                      "field_user_friendsOfFriends": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "field_user_friendsOfFriends_id": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "field_user_id": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "parent": undefined,
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
        {
          authorizedPosts: [
            {
              id: 'a',
              title: 'Hello world',
            },
            {
              id: 'b',
              title: 'Hello again world',
            },
          ],
        },
      ],
      {
        userId: 'foo',
      }
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
                  "LET authenticatedUser = DOCUMENT('users', @context.userId)
                  LET allAuthorizedPosts = UNION_DISTINCT(
                    (FOR post IN posts FILTER post.public == true RETURN post),
                    (FOR post IN OUTBOUND authenticatedUser posted RETURN post)
                  )
                  FOR authorizedPosts IN allAuthorizedPosts
                  RETURN {
                    title: authorizedPosts.title
                    id: FIRST(
                      LET authorizedPosts_id = authorizedPosts._key
                      RETURN authorizedPosts_id
                    )
                  }"
            `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
                                                                                    Object {
                                                                                      "context": Object {
                                                                                        "userId": "foo",
                                                                                      },
                                                                                      "field_authorizedPosts": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "field_authorizedPosts_id": Object {
                                                                                        "args": undefined,
                                                                                      },
                                                                                      "parent": undefined,
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
          user: {
            id: 'foo',
            fullName: 'Foo Bar',
          },
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
                                    "LET user = DOCUMENT(users, @field_user.args.id)
                                    RETURN {
                                      id: FIRST(
                                        LET user_id = user._key
                                        RETURN user_id
                                      ),
                                      fullName: FIRST(
                                        LET user_fullName = CONCAT(user.name, \\" \\", user.surname)
                                        RETURN user_fullName
                                      )
                                    }"
                        `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
                                                                              Object {
                                                                                "context": Object {},
                                                                                "field_user": Object {
                                                                                  "args": Object {
                                                                                    "id": "foo",
                                                                                  },
                                                                                },
                                                                                "field_user_fullName": Object {
                                                                                  "args": undefined,
                                                                                },
                                                                                "field_user_id": Object {
                                                                                  "args": undefined,
                                                                                },
                                                                                "parent": undefined,
                                                                              }
                                                    `);
  });

  test('does a Relay-style connection', async () => {
    await run(
      `
      query GetUser {
        user(id: "foo") {
          id

          postsConnection(after: "opaqueCursor") {
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
          user: {
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
                hasNextPage: true,
              },
            },
          },
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchInlineSnapshot(`
            "LET user = DOCUMENT(users, @field_user.args.id)
            RETURN {
              id: FIRST(
                LET user_id = user._key
                RETURN user_id
              ),
              postsConnection: FIRST(
                LET user_postsConnection_listPlusOne = (
                  FOR user_postsConnection_node, user_postsConnection_edge IN OUTBOUND user posted
                    OPTIONS {bfs: true}
                  SORT user_postsConnection_node._key
                  LIMIT @field_user_postsConnection.args.first + 1
                  RETURN MERGE(user_postsConnection_edge, { cursor: user_postsConnection_node._key, node: user_postsConnection_node })
                )
                LET user_postsConnection = {
                  edges: SLICE(user_postsConnection_listPlusOne, 0, @field_user_postsConnection.args.first)
                  pageInfo: { 
                    hasNextPage: LENGTH(user_postsConnection_listPlusOne) == @field_user_postsConnection.args.first + 1
                  }
                }
                RETURN {
                  edges: (
                    FOR user_postsConnection_edges IN user_postsConnection.edges
                    RETURN {
                      cursor: user_postsConnection_edges.cursor
                      node: FIRST(
                        LET user_postsConnection_edges_node = user_postsConnection_edges.node
                        RETURN {
                          title: user_postsConnection_edges_node.title
                          id: FIRST(
                            LET user_postsConnection_edges_node_id = user_postsConnection_edges_node._key
                            RETURN user_postsConnection_edges_node_id
                          )
                        }
                      )
                    }
                  ),
                  pageInfo: FIRST(
                    LET user_postsConnection_pageInfo = user_postsConnection.pageInfo
                    RETURN {
                      hasNextPage: user_postsConnection_pageInfo.hasNextPage
                    }
                  )
                }
              )
            }"
        `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
            Object {
              "context": Object {},
              "field_user": Object {
                "args": Object {
                  "id": "foo",
                },
              },
              "field_user_id": Object {
                "args": undefined,
              },
              "field_user_postsConnection": Object {
                "args": Object {
                  "after": "opaqueCursor",
                  "first": 10,
                },
              },
              "field_user_postsConnection_edges": Object {
                "args": undefined,
              },
              "field_user_postsConnection_edges_node": Object {
                "args": undefined,
              },
              "field_user_postsConnection_edges_node_id": Object {
                "args": undefined,
              },
              "field_user_postsConnection_pageInfo": Object {
                "args": undefined,
              },
              "parent": undefined,
            }
        `);
  });
});
