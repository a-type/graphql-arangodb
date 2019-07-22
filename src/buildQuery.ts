import { DBQuery } from './types';
import { createAllReplacer } from './utils/plugins';
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
  const statements = query.plugins.map(({ directiveArgs, plugin }) => {
    const fieldArgs = query.params.args || {};
    const interpolate = createAllReplacer({
      fieldName,
      parentName,
    });

    return interpolate(
      plugin.build({
        fieldName,
        parentName,
        fieldArgs,
        directiveArgs,
        returnsList: query.returnsList,
      })
    );
  });

  return lines([...statements, buildReturnProjection({ query, fieldName })]);
};

const buildReturnProjection = ({
  query,
  fieldName,
}: Omit<QueryBuilderArgs, 'parentName'>): string => {
  if (!query.fieldNames.length) {
    return `RETURN ${fieldName}`;
  }

  const scalarFields = query.fieldNames.filter(
    name => !query.fieldQueries[name]
  );
  const nonScalarFields = query.fieldNames.filter(
    name => query.fieldQueries[name]
  );

  return lines([
    `RETURN {`,
    lines(
      scalarFields.map(name => `${name}: ${fieldName}.${name}`).map(indent),
      ',\n'
    ),
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
