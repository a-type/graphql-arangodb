import {
  GraphQLResolveInfo,
  GraphQLObjectType,
  FieldNode,
  SelectionSetNode,
} from 'graphql';
import { DBQuery, PluginInstance, Plugin, DBQueryParams } from './types';
import { IGNORED_FIELD_NAMES } from './constants';
import { getFieldDef } from 'graphql/execution/execute';
import { getFieldDirectives, getDirectiveArgs } from './utils/directives';
import {
  getArgumentsPlusDefaults,
  isListOrWrappedListType,
  extractObjectType,
  getNameOrAlias,
} from './utils/graphql';
import { pathOr } from 'ramda';
import { getFieldPath } from './utils/graphql';
import defaultPlugins from './plugins';

type CommonExtractionParams = {
  info: GraphQLResolveInfo;
  parentQuery: DBQuery | undefined;
  parentType: GraphQLObjectType;
  path: string[];
  plugins: { [directiveName: string]: Plugin };
  argumentResolvers: { [path: string]: any };
};

export const extractQueriesFromResolveInfo = ({
  info,
  plugins = defaultPlugins,
  argumentResolvers = {},
}: {
  info: GraphQLResolveInfo;
  plugins?: { [directiveName: string]: Plugin };
  argumentResolvers?: { [path: string]: any };
}) =>
  extractQueriesFromField({
    info,
    parentQuery: undefined,
    parentType: info.parentType,
    field: info.fieldNodes[0],
    path: getFieldPath(info),
    plugins,
    argumentResolvers,
  });

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

  // abort this path if there is an @aqlNewQuery directive and this is not the root field
  if (
    parentQuery &&
    directives.some(({ name }) => name.value === 'aqlNewQuery')
  ) {
    return null;
  }

  const pluginInstances = directives
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

export const extractQueriesFromSelectionSet = ({
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
