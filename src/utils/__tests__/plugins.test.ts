import { createFieldArgGetter, createArgReplacer } from '../plugins';

test('arg replacer', () => {
  const getter = createFieldArgGetter('field_name');
  const argReplacer = createArgReplacer(getter);

  expect(argReplacer('$args')).toEqual('@field_field_name.args');
  expect(argReplacer('$args.foo.bar')).toEqual(
    '@field_field_name.args.foo.bar'
  );
  expect(argReplacer("$args['foo'].bar")).toEqual(
    "@field_field_name.args['foo'].bar"
  );
  expect(argReplacer('$args["foo"].bar')).toEqual(
    '@field_field_name.args["foo"].bar'
  );
  expect(argReplacer('$args[$args.foo].bar')).toEqual(
    '@field_field_name.args[@field_field_name.args.foo].bar'
  );
});
