import {
  GraphQLObjectType,
  GraphQLResolveInfo,
  FieldNode,
  SelectionSetNode,
} from 'graphql';
import {
  DBQuery,
  QueryFieldMap,
  Plugin,
  PluginInstance,
  DBQueryParams,
} from './types';
import { IGNORED_FIELD_NAMES } from './constants';
import {
  hasDirective,
  getFieldDirectives,
  getDirectiveArgs,
} from './utils/directives';
import { getFieldDef } from 'graphql/execution/execute';
import {
  getArgumentsPlusDefaults,
  isListOrWrappedListType,
  extractObjectType,
  getNameOrAlias,
} from './utils/graphql';

type CommonExtractionParams = {
  queries: QueryFieldMap;
  info: GraphQLResolveInfo;
  parentQuery: DBQuery | undefined;
  parentType: GraphQLObjectType;
  path: string[];
  plugins: { [directiveName: string]: Plugin };
};

export const extractQueriesFromOperation = (
  info: GraphQLResolveInfo,
  plugins: { [directiveName: string]: Plugin }
): QueryFieldMap =>
  info.fieldNodes.reduce(
    (queries: QueryFieldMap, field) =>
      extractQueriesFromField({
        queries,
        field,
        parentType: info.parentType,
        info,
        parentQuery: undefined,
        plugins,
        path: [getNameOrAlias(field)],
      }),
    {}
  );

const extractQueriesFromField = ({
  queries,
  info,
  parentQuery,
  parentType,
  field,
  path,
  plugins,
}: CommonExtractionParams & {
  field: FieldNode;
}) => {
  const fieldName = field.name.value;

  if (IGNORED_FIELD_NAMES.includes(fieldName)) {
    return queries;
  }

  const skip = hasDirective(parentType, fieldName, 'skip');

  if (parentQuery && !skip) {
    parentQuery.fieldNames.push(fieldName);
  }

  const schemaFieldDef = getFieldDef(info.schema, parentType, fieldName);
  if (!schemaFieldDef) {
    throw new Error(
      `Invalid state: there's no field definition for field "${fieldName}" on type "${parentType.name}"`
    );
  }

  let currentQuery: DBQuery | undefined = undefined;

  if (!skip) {
    const directives = getFieldDirectives(parentType, fieldName);
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

    if (pluginInstances.length) {
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
        // TODO: process via argReducer
        params.args = argValues;
      }

      currentQuery = {
        returnsList: isListOrWrappedListType(schemaFieldDef.type),
        plugins: pluginInstances,
        paramNames,
        params,
        fieldNames: [],
        fieldQueries: {},
      };

      if (parentQuery) {
        parentQuery.fieldQueries[fieldName] = currentQuery;
      } else {
        queries[path.join(',')] = currentQuery;
      }
    }
  }

  if (!field.selectionSet) {
    return queries;
  }

  const currentTypeAsObjectType = extractObjectType(schemaFieldDef.type);

  if (!currentTypeAsObjectType) {
    return queries;
  }

  return extractQueriesFromSelectionSet({
    selectionSet: field.selectionSet,
    queries,
    parentQuery,
    parentType: currentTypeAsObjectType,
    info,
    path,
    plugins,
  });
};

const extractQueriesFromSelectionSet = ({
  selectionSet,
  queries,
  path,
  ...rest
}: CommonExtractionParams & {
  selectionSet: SelectionSetNode;
}): QueryFieldMap =>
  selectionSet.selections.reduce((reducedQueries, selection) => {
    if (selection.kind === 'Field') {
      return extractQueriesFromField({
        queries: reducedQueries,
        field: selection,
        path: [...path, getNameOrAlias(selection)],
        ...rest,
      });
    } else if (selection.kind === 'InlineFragment') {
      return extractQueriesFromSelectionSet({
        selectionSet: selection.selectionSet,
        queries: reducedQueries,
        path,
        ...rest,
      });
    } else {
      const fragment = rest.info.fragments[selection.name.value];
      return extractQueriesFromSelectionSet({
        selectionSet: fragment.selectionSet,
        queries: reducedQueries,
        path,
        ...rest,
      });
    }
  }, queries);
