import { Database } from 'arangojs';

export const executeQuery = async ({
  query,
  bindVars,
  db,
  fieldName,
}: {
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
  return allResults[0];
};
