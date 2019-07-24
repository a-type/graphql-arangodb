import { Plugin } from '../types';
import { lines } from '../utils/strings';

export const aqlRelayNode: Plugin = {
  name: 'aqlRelayNode',
  build: () => lines([`LET $field = $parent.node`]),
};
