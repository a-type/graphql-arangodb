import { lines } from './strings';
/**
 * Statement builders for AQL
 */

export const buildLimit = (count: string, skip?: string) => {
  if (skip) {
    return `LIMIT ${skip} ${count}`;
  }

  return `LIMIT ${count}`;
};

export const buildFilter = (condition: string) => `FILTER ${condition}`;

export const buildSort = (property: string, order: string = 'ASC') =>
  `SORT $field[${interpolationOrString(property)}] ${order}`;

export const buildQueryModifiers = ({
  limit,
  filter,
  sort,
}: {
  limit?: {
    count: string;
    skip?: string;
  };
  filter?: string;
  sort?: {
    property: string;
    order: string;
  };
}): string =>
  lines([
    filter && buildFilter(filter),
    sort && buildSort(sort.property, sort.order),
    limit && buildLimit(limit.count, limit.skip),
  ]);

const interpolationOrString = (value: string) =>
  value.startsWith('$') ? value : JSON.stringify(value);
