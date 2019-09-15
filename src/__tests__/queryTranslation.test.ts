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
          id: 'foo',
          fullName: 'Foo Bar',
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
          id: 'foobar',
          name: 'Bob',
          simplePosts: [],
        },
      ]
    );

    expect(mockRunQuery.mock.calls[0][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchSnapshot();
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

    expect(mockRunQuery.mock.calls[0][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchSnapshot();

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

    expect(mockRunQuery.mock.calls[1][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[1][0].bindVars).toMatchSnapshot();
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
    expect(mockRunQuery.mock.calls[0][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[1][0].query).toMatchSnapshot();
    expect(mockRunQuery.mock.calls[1][0].bindVars).toMatchSnapshot();
  });
});
