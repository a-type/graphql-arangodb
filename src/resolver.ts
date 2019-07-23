import {
  GraphQLResolveInfo,
  FieldNode,
  SelectionSetNode,
  GraphQLObjectType,
} from 'graphql';
import { IGNORED_FIELD_NAMES } from './constants';
import { getFieldDef } from 'graphql/execution/execute';
import { DBQuery, PluginInstance, Plugin, DBQueryParams } from './types';
import {
  getFieldDirectives,
  getDirectiveArgs,
  getTypeDirectives,
} from './utils/directives';
import {
  getArgumentsPlusDefaults,
  isListOrWrappedListType,
  extractObjectType,
  getNameOrAlias,
  getFieldPath,
} from './utils/graphql';
import { pathOr } from 'ramda';
import defaultPlugins from './plugins';
import { buildQuery } from './buildQuery';
import { log } from './logger';
import { buildPrefixedVariables } from './utils/variables';
import { runQuery } from './runQuery';
import { Database } from 'arangojs';

export type ResolverCreatorParams = {
  plugins?: { [name: string]: Plugin };
  argumentResolvers?: { [pathPart: string]: any };
  contextKey?: string;
  db?: Database;
  contextDbKey?: string;
};

export const createResolver = ({
  plugins = defaultPlugins,
  argumentResolvers = {},
  db,
  contextDbKey = 'arangoDb',
  contextKey = 'arangoContext',
}: ResolverCreatorParams) => async (
  parent: any,
  args: { [key: string]: any },
  context: any,
  info: GraphQLResolveInfo
) => {
  const resolvedDb = db || context[contextDbKey];
  if (!resolvedDb) {
    throw new Error(
      `Either a valid ArangoDB Database instance must be supplied on the "${contextDbKey}" property of the context, or you must create your own resolver using createResolver from graphql-arangodb`
    );
  }

  const path = getFieldPath(info);

  const query = extractQueriesFromField({
    info,
    parentQuery: undefined,
    parentType: info.parentType,
    field: info.fieldNodes[0],
    path,
    plugins,
    argumentResolvers,
  });

  if (!query) {
    return null;
  }

  try {
    const queryString = buildQuery({
      query,
      fieldName: info.fieldName,
      parentName: '',
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

    const data = await runQuery({
      returnsList: query.returnsList,
      query: queryString,
      bindVars,
      db: resolvedDb,
    });

    log({
      title: `Query response data`,
      level: 'debug',
      details: [JSON.stringify(data)],
    });

    return data[info.fieldName];
  } catch (err) {
    log({
      title: `Query execution error`,
      level: 'error',
      details: [err.toString(), (err as Error).stack],
    });
    throw err;
  }
};

export const resolver = createResolver({});

type CommonExtractionParams = {
  info: GraphQLResolveInfo;
  parentQuery: DBQuery | undefined;
  parentType: GraphQLObjectType;
  path: string[];
  plugins: { [directiveName: string]: Plugin };
  argumentResolvers: { [path: string]: any };
};

export const extractQueriesFromField = ({
  info,
  parentQuery,
  parentType,
  field,
  path,
  plugins,
  argumentResolvers,
}: CommonExtractionParams & {
  field: FieldNode;
}): DBQuery | null => {
  const fieldName = field.name.value;

  if (IGNORED_FIELD_NAMES.includes(fieldName)) {
    return null;
  }

  if (parentQuery) {
    parentQuery.fieldNames.push(fieldName);
  }

  const schemaFieldDef = getFieldDef(info.schema, parentType, fieldName);
  if (!schemaFieldDef) {
    throw new Error(
      `Invalid state: there's no field definition for field "${fieldName}" on type "${parentType.name}"`
    );
  }

  const directives = getFieldDirectives(parentType, fieldName);
  const returnTypeDirectives = getTypeDirectives(schemaFieldDef.type);

  const pluginInstances = [...directives, ...returnTypeDirectives]
    .map(directive => {
      const matchingPlugin = plugins[directive.name.value];
      if (!matchingPlugin) {
        return null;
      }

      return {
        plugin: matchingPlugin,
        directiveArgs: getDirectiveArgs(directive, info.variableValues),
      } as PluginInstance;
    })
    .filter(Boolean) as PluginInstance[];

  if (!pluginInstances.length) {
    return null;
  }

  const argValues = getArgumentsPlusDefaults(
    parentType.name,
    field,
    info.schema,
    info.variableValues
  );

  const paramNames: string[] = [];
  const params: DBQueryParams = {};

  if (Object.keys(argValues).length) {
    paramNames.push('args');
    // process via arg resolver if it exists
    const argResolver = pathOr((a: any) => a, path, argumentResolvers);
    const resolvedArgs = argResolver(argValues);
    params.args = resolvedArgs;
  }

  const baseQuery = {
    returnsList: isListOrWrappedListType(schemaFieldDef.type),
    plugins: pluginInstances,
    paramNames,
    params,
    fieldNames: [],
    fieldQueries: {},
  };

  if (!field.selectionSet) {
    return baseQuery;
  }

  const currentTypeAsObjectType = extractObjectType(schemaFieldDef.type);

  if (!currentTypeAsObjectType) {
    return baseQuery;
  }

  baseQuery.fieldQueries = extractQueriesFromSelectionSet({
    selectionSet: field.selectionSet,
    parentQuery: baseQuery,
    parentType: currentTypeAsObjectType,
    info,
    path,
    plugins,
    argumentResolvers,
  });

  return baseQuery;
};

const extractQueriesFromSelectionSet = ({
  selectionSet,
  path,
  ...rest
}: CommonExtractionParams & {
  selectionSet: SelectionSetNode;
}): { [field: string]: DBQuery | null } =>
  selectionSet.selections.reduce((reducedQueries, selection) => {
    if (selection.kind === 'Field') {
      return {
        ...reducedQueries,
        [getNameOrAlias(selection)]: extractQueriesFromField({
          field: selection,
          path: [...path, getNameOrAlias(selection)],
          ...rest,
        }),
      };
    } else if (selection.kind === 'InlineFragment') {
      return {
        ...reducedQueries,
        ...extractQueriesFromSelectionSet({
          selectionSet: selection.selectionSet,
          path,
          ...rest,
        }),
      };
    } else {
      const fragment = rest.info.fragments[selection.name.value];
      return {
        ...reducedQueries,
        ...extractQueriesFromSelectionSet({
          selectionSet: fragment.selectionSet,
          path,
          ...rest,
        }),
      };
    }
  }, {});
