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

    await graphql({
      schema,
      source: query,
      contextValue: {
        arangoContext: contextValue,
        arangoDb: mockDb,
      },
    });
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
                                id: user.id,
                                name: user.name,
                                bio: user.bio
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
                                id: user.id,
                                name: user.name
                                simplePosts: (
                                  FOR user_simplePosts IN OUT user posted
                                  RETURN {
                                    id: user_simplePosts.id,
                                    title: user_simplePosts.title
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
        "field_user_simplePosts": Object {
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
                                id: user.id
                                filteredPosts: (
                                  FOR user_filteredPosts IN OUT user posted
                                  FILTER user_filteredPosts.title =~ @field_user_filteredPosts.args.titleMatch
                                  RETURN {
                                    id: user_filteredPosts.id,
                                    title: user_filteredPosts.title
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
            filteredPosts: [
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
                                id: user.id
                                paginatedPosts: (
                                  FOR user_paginatedPosts IN OUT user posted
                                  SORT user_paginatedPosts[@field_user_paginatedPosts.args.sort]
                                  LIMIT @field_user_paginatedPosts.args.skip, @field_user_paginatedPosts.args.count
                                  RETURN {
                                    id: user_paginatedPosts.id,
                                    title: user_paginatedPosts.title
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
        "field_user_paginatedPosts": Object {
          "args": Object {
            "count": 2,
            "sort": "title",
          },
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
            filteredPosts: [
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
                                id: user.id
                                descendingPosts: (
                                  FOR user_descendingPosts IN OUT user posted
                                  SORT user_descendingPosts[\\"title\\"] DESC
                                  RETURN {
                                    id: user_descendingPosts.id,
                                    title: user_descendingPosts.title
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
            friends: [
              {
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
                                id: user.id,
                                name: user.name
                                friends: (
                                  FOR user_friends_node, user_friends IN ANY user undefined
                                  RETURN {
                                    strength: user_friends.strength
                                    user: (
                                      LET user_friends_user = user_friends_node
                                      RETURN {
                                        id: user_friends_user.id,
                                        name: user_friends_user.name
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
                    id: user.id,
                    name: user.name
                    friendsOfFriends: (
                      FOR user_friendsOfFriends IN 2..2 ANY user friendOf OPTIONS {bfs: true, uniqueVertices: 'path'}
                      RETURN {
                        id: user_friendsOfFriends.id,
                        name: user_friendsOfFriends.name
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
        "parent": undefined,
      }
    `);
  });

  test('uses context values', async () => {
    await run(
      `
      query GetUserAndPagedPosts {
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
            "LET authenticatedUser = DOCUMENT(@context.userId)
            LET allAuthorizedPosts = UNION_DISTINCT(
              (FOR post IN posts FILTER post.public == true RETURN post),
              (FOR post IN OUTBOUND authenticatedUser posted RETURN post)
            )
            FOR authorizedPosts IN allAuthorizedPosts
            RETURN {
              id: authorizedPosts.id,
              title: authorizedPosts.title
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
        "parent": undefined,
      }
    `);
  });
});
