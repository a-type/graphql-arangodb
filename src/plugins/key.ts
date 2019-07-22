import { Plugin } from '../types';

export const key: Plugin = {
  name: 'key',
  build: () => `LET $field = $parent._key`,
};
