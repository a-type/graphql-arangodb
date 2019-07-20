import { document } from './document';
import { node } from './node';

export default {
  [document.directiveName]: document,
  [node.directiveName]: node,
};
