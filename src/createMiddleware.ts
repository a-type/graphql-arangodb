import { GraphQLResolveInfo, defaultFieldResolver } from 'graphql';
import { getIsRootField, getFieldPath } from './utils/graphql';
import { extractQueriesFromOperation } from './extractQueries';
import plugins from './plugins';
import { log } from './logger';
import { buildQuery } from './buildQuery';
import { runQuery } from './runQuery';
import { Database } from 'arangojs';

export const createMiddleware = ({
  db,
  argumentResolvers,
}: {
  db: Database;
  argumentResolvers: { [path: string]: any };
}) => async (
  resolve: Function,
  parent: any,
  args: { [key: string]: any },
  context: any,
  info: GraphQLResolveInfo
) => {
  const isWrite = info.operation.operation === 'mutation';
  const isRootField = getIsRootField(info);

  if (isRootField) {
    try {
      const queries = extractQueriesFromOperation(
        info,
        plugins,
        argumentResolvers
      );
      context.__graphqlArangodb = {
        queries,
      };
    } catch (err) {
      log({
        title: 'Error extracting queries from operation',
        level: 'error',
        details: [err.toString(), (err as Error).stack],
      });

      throw err;
    }
  }

  const path = getFieldPath(info);
  const pathString = path.join(',');

  const matchingQuery = context.__graphqlArangodb.queries[pathString];

  let run: (args: any, context: any, info: GraphQLResolveInfo) => Promise<any>;

  if (matchingQuery) {
    console.log(JSON.stringify(matchingQuery));
    run = async () => {
      try {
        const queryString = buildQuery({
          query: matchingQuery,
          fieldName: info.fieldName,
          parentName: '',
        });

        const bindVars = {}; // TODO

        log({
          title: `Running ${isWrite ? 'write' : 'read'} query`,
          level: 'info',
          details: [queryString, JSON.stringify(bindVars)],
        });

        const data = await runQuery({ query: queryString, bindVars, db });

        log({
          title: `Query response data`,
          level: 'debug',
          details: [JSON.stringify(data)],
        });

        return data;
      } catch (err) {
        log({
          title: 'Query execution error',
          level: 'error',
          details: [err.toString(), (err as Error).stack],
        });
        throw err;
      }
    };
  } else {
    run = async (providedArgs, providedContext, providedInfo) =>
      defaultFieldResolver(
        parent,
        providedArgs || args,
        providedContext || context,
        providedInfo || info
      );
  }

  const result = await resolve(
    {
      ...parent,
      [info.fieldName]: run,
    },
    args,
    context,
    info
  );

  return result;
};
