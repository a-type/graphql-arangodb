import { FIELD_PARAM_PREFIX } from '../constants';

export const createFieldArgGetter = (fieldName: string) => (
  argPath: string
) => {
  return argPath.replace(/\$args/g, `@${FIELD_PARAM_PREFIX}${fieldName}.args`);
};

/**
 * Creates a function which replaces all
 * "$args"
 * "$args.foo.bar" or
 * "$args['foo'].bar" or
 * "$args["foo"].bar" or
 * "$args[$args.foo].bar"
 * with the real argument string
 */
export const createArgReplacer = (argGetter: (name: string) => any) => (
  str: string
) => {
  const argMatcher = /\$args([\.\[]\w[\w\d]+)*/;
  let result;
  let modifiedStr = '' + str;

  while ((result = argMatcher.exec(modifiedStr)) !== null) {
    const text = result[0];
    const index = result.index;
    const splicedString = spliceString(
      modifiedStr,
      index,
      text,
      argGetter(text)
    );
    if (splicedString === modifiedStr) {
      // sanity check to avoid infinite looping
      throw new Error(
        'Infinite loop detected while interpolating query. This is probably a bug in graphql-arangodb. Please file a bug report with the GraphQL SDL + directives your query is evaluating!'
      );
    }
    modifiedStr = splicedString;
  }

  return modifiedStr;
};

/**
 * Creates a function which replaces all "$field" with the actual field name
 */
const createFieldReplacer = (fieldName: string) => (text: string) =>
  replaceAll(text, '$field', fieldName);
const createParentReplacer = (parentName: string) => (text: string) =>
  replaceAll(text, '$parent', parentName);
const createContextReplacer = () => (text: string) =>
  replaceAll(text, '$context', '@context');

const replaceAll = (
  text: string,
  original: string,
  replacement: string
): string => {
  let modifiedText = '' + text;
  let index;
  while ((index = modifiedText.indexOf(original)) >= 0) {
    modifiedText = spliceString(modifiedText, index, original, replacement);
  }
  return modifiedText;
};

const spliceString = (
  text: string,
  index: number,
  original: string,
  replacement: string
) => {
  return (
    text.slice(0, index) + replacement + text.slice(index + original.length)
  );
};

export const createAllReplacer = ({
  fieldName,
  parentName,
}: {
  fieldName: string;
  parentName: string;
}) => {
  const argReplacer = createArgReplacer(createFieldArgGetter(fieldName));
  const fieldReplacer = createFieldReplacer(fieldName);
  const parentReplacer = createParentReplacer(parentName);
  const contextReplacer = createContextReplacer();

  return (text: string): string =>
    contextReplacer(parentReplacer(fieldReplacer(argReplacer(text))));
};
