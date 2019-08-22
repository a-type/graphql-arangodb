import { DBQuery } from './types';
import { createAllReplacer } from './utils/plugins';
import { lines, indent } from './utils/strings';
import { buildSubquery as buildSubqueryStatement } from './utils/aql';

type QueryBuilderArgs = {
  query: DBQuery;
  fieldName: string;
  parentName: string;
};

export const buildQuery = ({
  query,
  fieldName,
}: Omit<QueryBuilderArgs, 'parentName'>): string => {
  return lines([
    `LET query = ${buildSubQuery({ query, fieldName, parentName: '@parent' })}`,
    `RETURN query`,
  ]);
};

export const buildSubQuery = ({
  query,
  fieldName,
  parentName,
}: QueryBuilderArgs): string => {
  const { directiveArgs, builder } = query.builder;
  const fieldArgs = query.params.args || {};
  const interpolate = createAllReplacer({
    fieldName,
    parentName,
  });

  const children = () => buildReturnProjection({ query, fieldName });

  const subquery = interpolate(
    builder.build({
      fieldName,
      parentName,
      fieldArgs,
      directiveArgs,
      returnsList: query.returnsList,
      children,
    })
  );

  if (query.condition) {
    return interpolate(
      buildSubqueryStatement(
        lines([
          `LET $field_condition = ${query.condition.expression}`,
          `RETURN $field_condition`,
          indent(`? (FILTER $field_condition ${subquery})`),
          indent(`: (FILTER !$field_condition RETURN null)`),
        ]),
        query.returnsList
      )
    );
  } else {
    return subquery;
  }
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
      [
        lines(
          scalarFields.map(name => `${name}: ${fieldName}.${name}`).map(indent),
          ',\n'
        ),
        lines(
          nonScalarFields
            .map(name => {
              const fieldQuery = query.fieldQueries[name];
              const subQueryString = buildSubQuery({
                query: fieldQuery,
                fieldName: joinFieldNames(fieldName, name),
                parentName: fieldName,
              });
              return `${name}: ${subQueryString}`;
            })
            .map(indent),
          ',\n'
        ),
      ],
      ',\n'
    ),
    `}`,
  ]);
};

const joinFieldNames = (baseName: string, name: string) =>
  `${baseName}_${name}`;
