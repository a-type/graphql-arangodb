import { Plugin } from '../types';

export const aqlKey: Plugin = {
  name: 'aqlKey',
  build: () => `LET $field = $parent._key`,
};
