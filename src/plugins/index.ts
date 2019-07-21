import { document } from './document';
import { node } from './node';
import { filter } from './filter';
import { sort } from './sort';
import { limit } from './limit';

export default {
  [document.directiveName]: document,
  [node.directiveName]: node,
  [filter.directiveName]: filter,
  [sort.directiveName]: sort,
  [limit.directiveName]: limit,
};
