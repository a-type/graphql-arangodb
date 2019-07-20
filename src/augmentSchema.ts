import { Database } from 'arangojs';
import { GraphQLSchema } from 'graphql';
import { applyMiddleware } from 'graphql-middleware';
import { createMiddleware } from './createMiddleware';

export const augmentSchema = ({
  argumentResolvers,
  db,
  schema,
}: {
  argumentResolvers: { [key: string]: any };
  db: Database;
  schema: GraphQLSchema;
}) => {
  const middleware = createMiddleware({ db, argumentResolvers });
  return applyMiddleware(schema, middleware);
};
