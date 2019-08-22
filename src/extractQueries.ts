import {
  GraphQLResolveInfo,
  GraphQLObjectType,
  FieldNode,
  SelectionSetNode,
} from 'graphql';
import {
  DBQuery,
  BuilderInstance,
  Builder,
  DBQueryParams,
  Condition,
} from './types';
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
import defaultPlugins from './builders';

type CommonExtractionParams = {
  info: GraphQLResolveInfo;
  parentQuery: DBQuery | undefined;
  parentType: GraphQLObjectType;
  path: string[];
  builders: { [directiveName: string]: Builder };
  argumentResolvers: { [path: string]: any };
};

export const extractQueriesFromResolveInfo = ({
  info,
  builders = defaultPlugins,
  argumentResolvers = {},
}: {
  info: GraphQLResolveInfo;
  builders?: { [directiveName: string]: Builder };
  argumentResolvers?: { [path: string]: any };
}) =>
  extractQueriesFromField({
    info,
    parentQuery: undefined,
    parentType: info.parentType,
    field: info.fieldNodes[0],
    path: getFieldPath(info),
    builders: builders,
    argumentResolvers,
  });

export const extractQueriesFromField = ({
  info,
  parentQuery,
  parentType,
  field,
  path,
  builders: builders,
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

  const builderDirective = directives.find(
    directive => !!builders[directive.name.value]
  );

  if (!builderDirective) {
    return null;
  }

  const builderInstance = {
    builder: builders[builderDirective.name.value],
    directiveArgs: getDirectiveArgs(builderDirective, info.variableValues),
  } as BuilderInstance;

  if (!builderInstance) {
    return null;
  }

  const conditionDirective = directives.find(
    directive => directive.name.value === 'aqlCondition'
  );
  let condition: Condition | null = null;
  if (conditionDirective) {
    const conditionDirectiveArgs = getDirectiveArgs(
      conditionDirective,
      info.variableValues
    );
    condition = {
      expression: conditionDirectiveArgs.expression,
    };
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
    builder: builderInstance,
    paramNames,
    params,
    fieldNames: [],
    fieldQueries: {},
    condition,
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
    builders: builders,
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
}): { [field: string]: DBQuery } =>
  selectionSet.selections.reduce((reducedQueries, selection) => {
    if (selection.kind === 'Field') {
      const fieldQuery = extractQueriesFromField({
        field: selection,
        path: [...path, getNameOrAlias(selection)],
        ...rest,
      });

      if (!fieldQuery) {
        return reducedQueries;
      }

      return {
        ...reducedQueries,
        [getNameOrAlias(selection)]: fieldQuery,
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
