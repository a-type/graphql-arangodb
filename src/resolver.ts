import { GraphQLResolveInfo } from 'graphql';
import { LibraryOptions, AqlResolver } from './types';
import defaultBuilders from './builders';
import { extractQueriesFromResolveInfo } from './extractQueries';
import { runQuery } from './runQuery';
import { createCustomQueryRunner } from './runCustomQuery';

export const createResolver = (options: LibraryOptions) => {
  const aqlResolver = async (
    parent: any,
    args: { [key: string]: any },
    context: any,
    info: GraphQLResolveInfo
  ) => {
    const { builders = defaultBuilders, argumentResolvers = {} } = options;

    const query = extractQueriesFromResolveInfo({
      info,
      builders,
      argumentResolvers,
    });

    if (!query) {
      return null;
    }

    return runQuery({
      options,
      info,
      query,
      context,
      parent,
    });
  };

  /**
   * Construct your own AQL query within a resolver, using whatever logic you wish,
   * then pass it to this function (along with bindVars). Also pass in the parent,
   * context and info arguments of your resolver. This function will take your original
   * query and append additional AQL to it so that it will resolve the rest of the
   * GraphQL query selections the user has made.
   */
  (aqlResolver as any).runCustomQuery = createCustomQueryRunner(options);

  return aqlResolver as AqlResolver;
};

export const resolver = createResolver({});
