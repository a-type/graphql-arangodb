import { Plugin } from '../types';
import { lines } from '../utils/strings';

export const aqlRelayEdges: Plugin = {
  name: 'aqlRelayEdges',
  build: () => lines([`FOR $field IN $parent.edges`]),
};
