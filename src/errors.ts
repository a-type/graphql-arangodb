export class FieldMissingError extends Error {
  constructor(typeName: string, fieldName: string) {
    super(
      `Invalid state: field "${fieldName}" does not exist on type "${typeName}"`
    );
  }
}
