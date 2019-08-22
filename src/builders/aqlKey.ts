import { Builder } from '../types';

export const aqlKey: Builder = {
  name: 'aqlKey',
  build: () => `$parent._key`,
};
