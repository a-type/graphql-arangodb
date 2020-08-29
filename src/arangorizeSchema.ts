import { GraphQLObjectType, GraphQLField, DirectiveNode } from 'graphql';
import { Database } from 'arangojs';
import {
  IExecutableSchemaDefinition,
  makeExecutableSchema,
} from 'graphql-tools';
import { directiveTypeDefs } from './typeDefs';
import { CollectionType, BaseCollection } from 'arangojs/lib/cjs/collection';

const AQL_INDEX_DIRECTIVE = 'aqlIndex';
const AQL_COLLECTION_DIRECTIVE = 'aqlCollection';

export const arangorizeSchema = async (
  props: IExecutableSchemaDefinition<any>,
  arangoDB: Database,
  ensureDB?: string
) => {
  props.typeDefs = `

    enum AqlCollectionType {
      DOCUMENT
      EDGE
    }
    enum AqlIndexType {
      PERSISTENT
      TTL
    }
    
    directive @${AQL_INDEX_DIRECTIVE}(
        unique: Boolean = false
        type: AqlIndexType = PERSISTENT
        expireAfter: Int
    ) on FIELD_DEFINITION
    
    directive @${AQL_COLLECTION_DIRECTIVE}(name: String, type: AqlCollectionType = DOCUMENT ) on OBJECT

    ${directiveTypeDefs}

    ${props.typeDefs}
  `;

  if (ensureDB) {
    arangoDB = arangoDB.useDatabase(ensureDB);
    if (!(await arangoDB.exists())) {
      try {
        arangoDB = await arangoDB.createDatabase(ensureDB);
      } catch {
        // hack create Database throws always error
      }
    }
  }

  const schema = makeExecutableSchema(props);

  const typeMap = schema.getTypeMap();

  for await (const k of Object.keys(typeMap)) {
    const type = typeMap[k] as GraphQLObjectType;
    await processDirective(AQL_COLLECTION_DIRECTIVE, type, async directive => {
      const args = parseDirectiveArguments(directive);
      const col = await ensureCollection(
        args?.name || type.name,
        args?.type
          ? args.type.toLowerCase()
          : CollectionType.DOCUMENT_COLLECTION,
        arangoDB
      );
      await ensureIndex(type, col);
    });
  }
  return schema;
};

const processDirective = async (
  name: string,
  type: (GraphQLObjectType & { astNode: any }) | GraphQLField<any, any, any>,
  process?: (directive: DirectiveNode) => Promise<void>
): Promise<DirectiveNode | undefined> => {
  const directive = type.astNode?.directives?.find(
    (x: DirectiveNode) => x.name.value === name
  );
  if (directive && process) {
    await process(directive);
  }
  return directive;
};

const parseDirectiveArguments = (directive: DirectiveNode) => {
  let args: { [k: string]: any } | undefined;
  directive.arguments?.forEach(
    x =>
      (args = {
        ...args,
        [x.name.value]: (x.value as any).value,
      })
  );
  return args;
};

const ensureIndex = async (
  type: GraphQLObjectType<any, any, { [key: string]: any }>,
  col: BaseCollection
) => {
  const fields = type.getFields();
  for (const k in fields) {
    const field = fields[k];
    await processDirective(AQL_INDEX_DIRECTIVE, field, async directive => {
      const args = parseDirectiveArguments(directive);
      await col.ensureIndex({
        name: field.name,
        type: args?.type?.toLowerCase() || 'persistent',
        expireAfter: args?.expireAfter || 0,
        fields: [field.name],
        unique: args?.unique || false,
        deduplicate: false,
      });
    });
  }
};

const ensureCollection = async (
  name: string,
  type: CollectionType,
  db: Database
) => {
  const col = db.collection(name);
  if (!(await col.exists())) {
    await col.create({ type } as any);
  }
  return col as BaseCollection;
};
