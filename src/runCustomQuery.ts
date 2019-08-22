import { GraphQLResolveInfo } from 'graphql';
import { LibraryOptions, Builder } from './types';
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

export const createCustomQueryRunner = (options: LibraryOptions) => async ({
  queryString,
  info,
  context,
  parent,
  bindVars,
}: {
  queryString: string;
  bindVars?: { [name: string]: any };
  info: GraphQLResolveInfo;
  context: any;
  parent: any;
}) => {
  const { builders = defaultBuilders, argumentResolvers = {} } = options;

  const customQueryBuilder: Builder = {
    name: 'customQuery',
    build: ({ children, returnsList }) =>
      buildSubquery(
        lines([
          `LET $field = ${buildSubquery(queryString, returnsList)}`,
          children(),
        ]),
        returnsList
      ),
  };

  const query = {
    returnsList: isListOrWrappedListType(info.returnType),
    builder: {
      builder: customQueryBuilder,
      directiveArgs: {},
    },

    paramNames: [],
    params: {},
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

  query.fieldQueries = extractQueriesFromSelectionSet({
    selectionSet,
    info,
    path: getFieldPath(info),
    parentQuery: query,
    parentType: returnTypeAsObjectType,
    builders,
    argumentResolvers,
  });

  return runQuery({
    options,
    context,
    query,
    info,
    parent,
    additionalBindVars: bindVars,
  });
};

export const runCustomQuery = createCustomQueryRunner({});
