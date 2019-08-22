import { Database } from 'arangojs';
import { GraphQLResolveInfo } from 'graphql';
export type DBQuery = {
  returnsList: boolean;

  fieldNames: string[];
  fieldQueries: {
    [name: string]: DBQuery;
  };

  paramNames: string[];
  params: DBQueryParams;

  builder: BuilderInstance;

  /**
   * A condition controls whether a sub-query branch is run,
   * or if null is returned instead
   */
  condition: Condition | null;
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

export type Condition = {
  expression: string;
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
    queryString: string;
    bindVars?: { [name: string]: any };
    info: GraphQLResolveInfo;
    parent: any;
    context: any;
  }) => Promise<any>;
};
