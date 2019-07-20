export type DBQuery = {
  returnsList: boolean;

  fieldNames: string[];
  fieldQueries: {
    [name: string]: DBQuery;
  };

  paramNames: string[];
  params: DBQueryParams;

  plugins: PluginInstance[];
};

export type DBQueryParams = {
  args?: { [name: string]: any };
};

export type QueryFieldMap = {
  [path: string]: DBQuery;
};

export type Plugin = {
  directiveName: string;
  build: (args: {
    fieldName: string;
    directiveArgs: { [name: string]: any };
    fieldArgs: { [name: string]: any };
    getFieldArg(path: string): any;
    returnsList: boolean;
    parentName: string;
  }) => string;
};

export type PluginInstance = {
  plugin: Plugin;
  directiveArgs: { [name: string]: any };
};
