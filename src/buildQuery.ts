import { DBQuery } from './types';
import { createFieldArgGetter } from './utils/plugins';
import { lines, indent } from './utils/strings';

type QueryBuilderArgs = {
  query: DBQuery;
  fieldName: string;
  parentName: string;
};

export const buildQuery = ({
  query,
  fieldName,
  parentName,
}: QueryBuilderArgs): string => {
  const statements = query.plugins.map(({ directiveArgs, plugin }) =>
    plugin.build({
      fieldName,
      parentName,
      fieldArgs: query.params.args || {},
      getFieldArg: createFieldArgGetter(query.params.args || {}),
      directiveArgs,
      returnsList: query.returnsList,
    })
  );

  return lines([...statements, buildReturnProjection({ query, fieldName })]);
};

const buildReturnProjection = ({
  query,
  fieldName,
}: Omit<QueryBuilderArgs, 'parentName'>): string => {
  const scalarFields = query.fieldNames.filter(
    name => !query.fieldQueries[name]
  );
  const nonScalarFields = query.fieldNames.filter(
    name => query.fieldQueries[name]
  );

  return lines([
    `RETURN {`,
    lines(scalarFields.map(name => `${name}: ${name}`).map(indent), ',\n'),
    lines(
      nonScalarFields
        .map(name => {
          const fieldQuery = query.fieldQueries[name];
          const subQueryString = buildQuery({
            query: fieldQuery,
            fieldName: joinFieldNames(fieldName, name),
            parentName: fieldName,
          });
          return lines([`${name}: (`, indent(subQueryString), `)`]);
        })
        .map(indent),
      ',\n'
    ),
    `}`,
  ]);
};

const joinFieldNames = (baseName: string, name: string) =>
  `${baseName}_${name}`;
