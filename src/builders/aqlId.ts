import { Builder } from '../types';

export const aqlId: Builder = {
  name: 'aqlId',
  build: () => `$parent._id`,
};
