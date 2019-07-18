import { path } from 'ramda';

export const createFieldArgGetter = (fieldArgs: { [name: string]: any }) => (
  argPath: string
) => {
  const valuePath = argPath.replace('$args', '').split('.');
  return path(valuePath, fieldArgs);
};
