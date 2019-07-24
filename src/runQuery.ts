import { GraphQLResolveInfo } from 'graphql';
import { DBQuery, LibraryOptions } from './types';
import { buildQuery } from './buildQuery';
import { buildPrefixedVariables } from './utils/variables';
import { executeQuery } from './executeQuery';
import { log } from './logger';

export const runQuery = async ({
  options,
  context,
  query,
  info,
  additionalBindVars,
  parent,
}: {
  options: LibraryOptions;
  context: any;
  query: DBQuery;
  info: GraphQLResolveInfo;
  additionalBindVars?: { [name: string]: any };
  parent: any;
}) => {
  const {
    db,
    contextKey = 'arangoContext',
    contextDbKey = 'arangoDb',
  } = options;

  const resolvedDb = db || context[contextDbKey];
  if (!resolvedDb) {
    throw new Error(
      `Either a valid ArangoDB Database instance must be supplied on the "${contextDbKey}" property of the context, or you must create your own resolver using createResolver from graphql-arangodb`
    );
  }

  try {
    const queryString = buildQuery({
      query,
      fieldName: info.fieldName,
    });

    const bindVars = buildPrefixedVariables({
      fieldName: info.fieldName,
      query,
      parent,
      contextValues: context[contextKey],
    });

    log({
      title: `Running query`,
      level: 'info',
      details: [queryString, JSON.stringify(bindVars)],
    });

    const data = await executeQuery({
      query: queryString,
      bindVars: {
        ...(additionalBindVars || {}),
        ...bindVars,
      },
      db: resolvedDb,
      fieldName: info.fieldName,
    });

    log({
      title: `Query response data`,
      level: 'debug',
      details: [JSON.stringify(data)],
    });

    return data;
  } catch (err) {
    log({
      title: `Query execution error`,
      level: 'error',
      details: [err.toString(), (err as Error).stack],
    });
    throw err;
  }
};
