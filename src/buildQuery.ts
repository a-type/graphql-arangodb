import { DBQuery } from './types';

export const buildQuery = (query: DBQuery) => {};

const buildReturnProjection = (query: DBQuery) => {
  const scalarFields = query.fieldNames.filter(
    name => !query.fieldQueries[name]
  );
  const nonScalarFields = query.fieldNames.filter(
    name => query.fieldQueries[name]
  );

  return `RETURN {
    ${scalarFields.map(name => `${name}: ${name}`).join(',\n')}
    ${nonScalarFields
      .map(name => {
        const fieldQuery = query.fieldQueries[name];
        const subQueryString = buildQuery(fieldQuery);
        return `${name}: (\n${subQueryString}\n)`;
      })
      .join(',\n')}
  }`;
};
