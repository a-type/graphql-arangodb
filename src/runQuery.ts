import { Database } from 'arangojs';

export const runQuery = async ({
  query,
  bindVars,
  db,
}: {
  query: string;
  bindVars: { [name: string]: any };
  db: Database;
}) => {
  const queryResult = await db.query({
    query,
    bindVars,
  });

  return queryResult;
};
