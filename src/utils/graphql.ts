import { FieldMissingError } from '../errors';
import {
  GraphQLOutputType,
  isListType,
  isNonNullType,
  FieldNode,
  GraphQLObjectType,
  GraphQLSchema,
  isObjectType,
  ValueNode,
  NameNode,
} from 'graphql';

export const getArgumentsPlusDefaults = (
  parentTypeName: string,
  field: FieldNode,
  schema: GraphQLSchema,
  variables: { [name: string]: any }
): { [name: string]: any } => {
  const schemaType = schema.getType(parentTypeName);

  if (!schemaType || !isObjectType(schemaType)) {
    throw new Error(
      `Invalid state: Unknown or non-object type name "${parentTypeName}" (type: ${schemaType})`
    );
  }

  const schemaField = schemaType.getFields()[field.name.value];

  if (!schemaField) {
    throw new FieldMissingError(schemaType.name, field.name.value);
  }

  const defaults = schemaField.args.reduce(
    (argMap, arg) =>
      arg.defaultValue !== undefined
        ? { ...argMap, [arg.name]: arg.defaultValue }
        : argMap,
    {}
  );

  return {
    ...defaults,
    ...argFieldsToValues({}, field.arguments || [], variables),
  };
};

export const argFieldsToValues = (
  providedValues: { [key: string]: any },
  fields: readonly { value: ValueNode; name: NameNode }[],
  variables: { [variableName: string]: any }
) =>
  fields.reduce((acc, fieldNode) => {
    acc[fieldNode.name.value] = valueNodeToValue(fieldNode.value, variables);
    return acc;
  }, providedValues);

export const valueNodeToValue = (
  valueNode: ValueNode,
  variables: { [variableName: string]: any }
): any => {
  if (valueNode.kind === 'Variable') {
    return variables[valueNode.name.value];
  } else if (valueNode.kind === 'NullValue') {
    return null;
  } else if (valueNode.kind === 'ObjectValue') {
    return argFieldsToValues({}, valueNode.fields, variables);
  } else if (valueNode.kind === 'ListValue') {
    return valueNode.values.map(value => valueNodeToValue(value, variables));
  } else if (valueNode.kind === 'IntValue') {
    return parseInt(valueNode.value, 10);
  } else if (valueNode.kind === 'FloatValue') {
    return parseFloat(valueNode.value);
  } else {
    return valueNode.value;
  }
};

export const isListOrWrappedListType = (type: GraphQLOutputType): boolean => {
  if (isListType(type)) {
    return true;
  }
  if (isNonNullType(type)) {
    return isListOrWrappedListType(type.ofType);
  }
  return false;
};

export const getNameOrAlias = (field: FieldNode): string =>
  field.alias ? field.alias.value : field.name.value;

export const extractObjectType = (
  type: GraphQLOutputType
): GraphQLObjectType<any, any, any> | null => {
  if (isObjectType(type)) {
    return type;
  }

  // TODO: interface / union ?

  if (isNonNullType(type) || isListType(type)) {
    return extractObjectType(type.ofType);
  }

  return null;
};
