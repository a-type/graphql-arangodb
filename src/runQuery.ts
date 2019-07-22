import { Database } from 'arangojs';

export const runQuery = async ({
  returnsList,
  query,
  bindVars,
  db,
}: {
  returnsList: boolean;
  query: string;
  bindVars: { [name: string]: any };
  db: Database;
}) => {
  const queryResult = await db.query({
    query,
    bindVars,
  });

  const allResults = await queryResult.all();
  if (!returnsList) {
    return allResults[0];
  }
  return allResults;
};
