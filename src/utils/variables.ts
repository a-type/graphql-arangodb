import { DBQuery } from '../types';
import { FIELD_PARAM_PREFIX } from '../constants';

/**
 * recursively flattens and builds a set of arg object variables for a query
 * and all its sub-queries
 */
const buildPrefixedFieldArgVariables = ({
  fieldName,
  query,
}: {
  fieldName: string;
  query: DBQuery;
}): { [name: string]: any } => ({
  [`${FIELD_PARAM_PREFIX}${fieldName}`]: {
    args: query.params.args,
  },
  ...query.fieldNames
    .filter((childFieldName: string) => !!query.fieldQueries[childFieldName])
    .reduce(
      (args: { [name: string]: any }, childFieldName: string) => ({
        ...args,
        ...buildPrefixedFieldArgVariables({
          fieldName: fieldName + '_' + childFieldName,
          query: query.fieldQueries[childFieldName],
        }),
      }),
      {}
    ),
});

export const buildPrefixedVariables = ({
  fieldName,
  query,
  parent,
  contextValues,
}: {
  fieldName: string;
  query: DBQuery;
  parent?: any;
  contextValues?: any;
}) => {
  return {
    // passing the parent as a variable lets us cross the graphql -> graphdb boundary
    // and give queries access to their parent objects from our GraphQL context
    parent,
    // the user may supply values in their context which they always want passed to queries
    context: contextValues,

    ...buildPrefixedFieldArgVariables({ fieldName, query }),
  };
};
