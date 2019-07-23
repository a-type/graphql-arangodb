import { Database } from 'arangojs';

export const runQuery = async ({
  returnsList,
  query,
  bindVars,
  db,
  fieldName,
}: {
  returnsList: boolean;
  query: string;
  bindVars: { [name: string]: any };
  db: Database;
  fieldName: string;
}) => {
  const queryResult = await db.query({
    query,
    bindVars,
  });

  const allResults = await queryResult.all();
  return allResults[0][fieldName];
};
