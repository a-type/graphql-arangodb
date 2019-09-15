import { GraphQLResolveInfo } from 'graphql';
import { LibraryOptions, Builder, BuilderInstance } from './types';
import defaultBuilders from './builders';
import {
  isListOrWrappedListType,
  extractObjectType,
  getFieldPath,
} from './utils/graphql';
import { extractQueriesFromSelectionSet } from './extractQueries';
import { runQuery } from './runQuery';
import { lines } from './utils/strings';
import { buildSubquery } from './utils/aql';
import { AqlQuery } from 'arangojs/lib/cjs/aql-query';

export const createCustomQueryRunner = (options: LibraryOptions) => async ({
  info,
  context,
  parent,
  query,
  queryBuilder: providedBuilder,
  args,
}: {
  query?: AqlQuery;
  queryBuilder?: BuilderInstance;
  info: GraphQLResolveInfo;
  context: any;
  parent: any;
  args: { [name: string]: any };
}) => {
  const { builders = defaultBuilders, argumentResolvers = {} } = options;

  if (!providedBuilder && !query) {
    throw new Error('At least one of queryBuilder or query must be provided');
  }

  const customQueryBuilder: Builder = {
    name: 'customQuery',
    build: ({ children, returnsList }) =>
      buildSubquery(
        lines([
          `LET $field = ${buildSubquery(
            (query as AqlQuery).query,
            returnsList
          )}`,
          children(),
        ]),
        returnsList
      ),
  };

  const builderQuery = {
    returnsList: isListOrWrappedListType(info.returnType),
    builder: providedBuilder || {
      builder: customQueryBuilder,
      directiveArgs: {},
    },

    paramNames: ['args'],
    params: {
      args,
    },
    fieldNames: [],
    fieldQueries: {},
  };

  const selectionSet = info.fieldNodes[0].selectionSet;
  const returnTypeAsObjectType = extractObjectType(info.returnType);

  if (!selectionSet || !returnTypeAsObjectType) {
    throw new Error(
      'Not implemented: custom query without GraphQL selection or Object return type'
    );
  }

  builderQuery.fieldQueries = extractQueriesFromSelectionSet({
    selectionSet,
    info,
    path: getFieldPath(info),
    parentQuery: builderQuery,
    parentType: returnTypeAsObjectType,
    builders,
    argumentResolvers,
  });

  return runQuery({
    options,
    context,
    query: builderQuery,
    info,
    parent,
    additionalBindVars: query && query.bindVars,
  });
};

export const runCustomQuery = createCustomQueryRunner({});
