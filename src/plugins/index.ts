import { document } from './document';
import { node } from './node';
import { filter } from './filter';

export default {
  [document.directiveName]: document,
  [node.directiveName]: node,
  [filter.directiveName]: filter,
};
