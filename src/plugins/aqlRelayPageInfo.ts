import { Plugin } from '../types';
import { lines } from '../utils/strings';

export const aqlRelayPageInfo: Plugin = {
  name: 'aqlRelayPageInfo',
  build: () => lines([`LET $field = $parent.pageInfo`]),
};
