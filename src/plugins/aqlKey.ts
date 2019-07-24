import { Plugin } from '../types';

export const aqlKey: Plugin = {
  name: 'aqlKey',
  build: () => `$parent._key`,
};
