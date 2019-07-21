import { makeExecutableSchema } from 'graphql-tools';
import typeDefs from './fixtures/typeDefs';
import { augmentSchema } from '../augmentSchema';
import { Database } from 'arangojs';
import { graphql } from 'graphql';

describe('query translation integration tests', () => {
  const baseSchema = makeExecutableSchema({
    typeDefs,
  });

  const mockRunQuery = jest.fn();

  const mockDb = ({
    query: mockRunQuery,
  } as any) as Database;

  const schema = augmentSchema({
    argumentResolvers: {},
    db: mockDb,
    schema: baseSchema,
  });

  const run = async (
    query: string,
    mockResults: any[],
    contextValue: any = {}
  ) => {
    mockResults.forEach(mockResult => {
      mockRunQuery.mockResolvedValueOnce(mockResult);
    });

    await graphql({
      schema,
      source: query,
      contextValue,
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
            "LET user = DOCUMENT(users, \\"@field_user.args.id\\")
            RETURN {
              id: id,
              name: name,
              bio: bio
            }"
        `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "context": undefined,
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
            "LET user = DOCUMENT(users, \\"@field_user.args.id\\")
            RETURN {
              id: id,
              name: name
              simplePosts: (
                FOR user_simplePosts IN OUT user
                  posted
                RETURN {
                  id: id,
                  title: title
                }
              )
            }"
        `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "context": undefined,
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
            "LET user = DOCUMENT(users, \\"@field_user.args.id\\")
            RETURN {
              id: id
              filteredPosts: (
                FOR user_filteredPosts IN OUT user
                  posted
                FILTER user_filteredPosts.title =~ @field_user_filteredPosts.args.titleMatch
                RETURN {
                  id: id,
                  title: title
                }
              )
            }"
        `);
    expect(mockRunQuery.mock.calls[0][0].bindVars).toMatchInlineSnapshot(`
      Object {
        "context": undefined,
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
});
