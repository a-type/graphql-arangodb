import { makeExecutableSchema } from 'graphql-tools';
import typeDefs from './fixtures/typeDefs';
import { Database } from 'arangojs';
import { graphql } from 'graphql';
import aqlResolver from '..';

describe('query translation integration tests', () => {
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers: {
      Query: {
        user: aqlResolver,
        users: aqlResolver,
        authorizedPosts: aqlResolver,
      },
      Mutation: {
        createUser: async (parent, args, ctx, info) => {
          const bindVars = {
            userId: 'foobar',
            role: 'captain',
            name: 'Bob',
          };

          return aqlResolver.runCustomQuery({
            queryString: `
              INSERT {_key: @userId, role: @captain, name: @name} INTO users
              RETURN NEW
            `,
            bindVars,
            parent,
            context: ctx,
            info,
          });
        },
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
          Promise.resolve([
            {
              query: mockResult,
            },
          ]),
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

    expect(mockRunQuery.mock.calls[0][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchSnapshot();
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

    expect(mockRunQuery.mock.calls[0][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchSnapshot();
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

    expect(mockRunQuery.mock.calls[0][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchSnapshot();
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

    expect(mockRunQuery.mock.calls[0][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchSnapshot();
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

    expect(mockRunQuery.mock.calls[0][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchSnapshot();
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

    expect(mockRunQuery.mock.calls[0][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchSnapshot();
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

    expect(mockRunQuery.mock.calls[0][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchSnapshot();
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

    expect(mockRunQuery.mock.calls[0][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchSnapshot();
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

    expect(mockRunQuery.mock.calls[0][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchSnapshot();
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

    expect(mockRunQuery.mock.calls[0][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchSnapshot();
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
          user: {
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
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchSnapshot();
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
          createUser: {
            id: 'foobar',
            name: 'Bob',
            simplePosts: [],
          },
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchSnapshot();
  });
});
