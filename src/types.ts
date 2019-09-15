import { Database } from 'arangojs';
import { GraphQLResolveInfo } from 'graphql';
import { AqlQuery } from 'arangojs/lib/cjs/aql-query';
export type DBQuery = {
  returnsList: boolean;

  fieldNames: string[];
  fieldQueries: {
    [name: string]: DBQuery;
  };

  paramNames: string[];
  params: DBQueryParams;

  builder: BuilderInstance;
};

export type DBQueryParams = {
  args?: { [name: string]: any };
};

export type QueryFieldMap = {
  [path: string]: DBQuery;
};

export type Builder = {
  name: string;
  build: (args: {
    fieldName: string;
    directiveArgs: { [name: string]: any };
    fieldArgs: { [name: string]: any };
    returnsList: boolean;
    parentName: string;
    children: () => string;
  }) => string;
};

export type BuilderInstance = {
  builder: Builder;
  directiveArgs: { [name: string]: any };
};

export type LibraryOptions = {
  builders?: { [name: string]: Builder };
  argumentResolvers?: { [pathPart: string]: any };
  contextKey?: string;
  db?: Database;
  contextDbKey?: string;
};

export type AqlResolver = {
  (parent: any, args: any, context: any, info: GraphQLResolveInfo): Promise<
    any
  >;
  runCustomQuery: (args: {
    query?: AqlQuery;
    queryBuilder?: BuilderInstance;
    info: GraphQLResolveInfo;
    parent: any;
    args: any;
    context: any;
  }) => Promise<any>;
};
