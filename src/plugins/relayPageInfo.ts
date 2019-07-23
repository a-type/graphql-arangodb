import { Plugin } from '../types';
import { lines } from '../utils/strings';

export const relayPageInfo: Plugin = {
  name: 'relayPageInfo',
  build: () => lines([`LET $field = $parent.pageInfo`]),
};
