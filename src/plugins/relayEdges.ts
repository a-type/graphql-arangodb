import { Plugin } from '../types';
import { lines } from '../utils/strings';

export const relayEdges: Plugin = {
  name: 'relayEdges',
  build: () => lines([`FOR $field IN $parent.edges`]),
};
