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

export type PluginInstance = {
  plugin: Plugin;
  directiveArgs: { [name: string]: any };
};
