import { path } from 'ramda';

export const createFieldArgGetter = (fieldArgs: { [name: string]: any }) => (
  argPath: string
) => {
  console.log(fieldArgs, argPath);
  const valuePath = argPath
    .replace('$args.', '')
    .split('.')
    .filter(Boolean);
  return path(valuePath, fieldArgs);
};
