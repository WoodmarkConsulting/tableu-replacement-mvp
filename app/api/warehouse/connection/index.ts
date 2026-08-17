import { DBSQLClient } from "@databricks/sql";
import IDBSQLClient, {
  ConnectionOptions,
} from "@databricks/sql/dist/contracts/IDBSQLClient";

type QueryParameterValue = string | number | boolean | bigint | Date | null;

export type QueryParameters = Record<string, QueryParameterValue>;

const server_hostname = process.env.HOSTNAME;
const http_path = process.env.HTTP_PATH;
const clientID = process.env.DATABRICKS_OAUTH_CLIENT_ID;
const clientSecret = process.env.DATABRICKS_OAUTH_CLIENT_SECRET;

if (!server_hostname || !http_path || !clientID || !clientSecret) {
  throw new Error("Missing required environment variables");
}

const dbsqlClient = new DBSQLClient();

const options: ConnectionOptions = {
  host: server_hostname,
  path: http_path,
  authType: "databricks-oauth",
  oauthClientId: clientID,
  oauthClientSecret: clientSecret,
  useDatabricksOAuthInAzure: true,
};

let connectedClient: IDBSQLClient | null = null;
let connectingPromise: Promise<IDBSQLClient> | null = null;

const connectClient = async (): Promise<IDBSQLClient> => {
  if (connectedClient) {
    return connectedClient;
  }

  if (!connectingPromise) {
    connectingPromise = dbsqlClient.connect(options).then((client) => {
      connectedClient = client;
      connectingPromise = null;
      return client;
    });
  }

  return connectingPromise;
};

const resetClient = async () => {
  try {
    await connectedClient?.close();
  } catch {
    // ignore close errors
  } finally {
    connectedClient = null;
    connectingPromise = null;
  }
};

export const runQuery = async <T extends object>(
  query: string,
  parameters: QueryParameters = {},
): Promise<T[]> => {
  let session;
  let queryOperation;

  try {
    const client = await connectClient();

    session = await client.openSession();

    queryOperation = await session.executeStatement(query, {
      runAsync: true,
      namedParameters: parameters,
    });

    const result = await queryOperation.fetchAll();
    return result as T[];
  } catch (error) {
    await resetClient();

    const errorMessage =
      error instanceof Error
        ? error.message
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (error as any)?.errorMessage || "Unknown error occurred";

    throw new Error(`Failed to run query: ${errorMessage}`);
  } finally {
    await queryOperation?.close().catch(() => undefined);
    await session?.close().catch(() => undefined);
  }
};
