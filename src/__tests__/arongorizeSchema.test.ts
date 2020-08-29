import { Database } from 'arangojs';
import { ArangoDBContainer, StartedArangoContainer } from 'testcontainers';
import { Config } from 'arangojs/lib/cjs/connection';
import { arangorizeSchema } from '../arangorizeSchema';

describe('arangorize', () => {
  jest.setTimeout(60000);
  let container: StartedArangoContainer;
  let db: Database;

  beforeAll(async () => {
    container = await new ArangoDBContainer().start();
    db = new Database({
      url: container.getHttpUrl(),
    } as Config);
    db.useBasicAuth(container.getUsername(), container.getPassword());
  });

  beforeEach(async () => {
    db.useDatabase('_system');
  });

  afterAll(async () => {
    await container?.stop();
  });

  test('Create database', async () => {
    const typeDefs = '';
    const dbName = 'testDB';
    await arangorizeSchema({ typeDefs }, db, dbName);

    const testDB = db.useDatabase(dbName);
    expect(testDB.exists()).toBeTruthy();
  });

  test('Create document collection', async () => {
    const typeDefs = `
    type User @aqlCollection(name: "users") {
      id: String!
    }`;

    await arangorizeSchema({ typeDefs }, db);

    const col = db.collection('users');

    expect(await col.exists()).toBeTruthy();
  });

  test('Create edge collection', async () => {
    const typeDefs = `
    type FriendsEdge @aqlCollection(name: "friends" type: EDGE) {
      id: String!
    }`;

    await arangorizeSchema({ typeDefs }, db);

    const col = db.collection('friends');

    expect(await col.exists()).toBeTruthy();
  });

  test('Create document collection with indexes', async () => {
    const db = new Database({
      url: container.getHttpUrl(),
    } as Config);

    db.useDatabase('_system');
    db.useBasicAuth(container.getUsername(), container.getPassword());

    const typeDefs = `
    type IndexTest @aqlCollection {
      unique: String! @aqlIndex(unique: true)
      nonUnique: String! @aqlIndex
      ttl: String! @aqlIndex(type: TTL)
    }`;

    await arangorizeSchema({ typeDefs }, db);

    const col = db.collection('IndexTest');

    const indexes = (await col.indexes()) as {
      name: String;
      type: string;
      unique: boolean;
    }[];

    const getIndex = (name: string) => indexes.find(i => i.name === name);

    expect(getIndex('unique')).toMatchObject({
      name: 'unique',
      unique: true,
      type: 'persistent',
    });

    expect(getIndex('nonUnique')).toMatchObject({
      name: 'nonUnique',
      unique: false,
      type: 'persistent',
    });

    expect(getIndex('ttl')).toMatchObject({
      name: 'ttl',
      unique: false,
      type: 'ttl',
    });
  });
});
