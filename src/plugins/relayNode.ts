import { Plugin } from '../types';
import { lines } from '../utils/strings';

export const relayNode: Plugin = {
  name: 'relayNode',
  build: () => lines([`LET $field = $parent.node`]),
};
