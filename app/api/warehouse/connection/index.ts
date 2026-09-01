import { DBSQLClient } from "@databricks/sql";
import IDBSQLClient, {
  ConnectionOptions,
} from "@databricks/sql/dist/contracts/IDBSQLClient";
import { QueryParameters } from "../../utils/types";

const server_hostname = process.env.HOSTNAME;
const http_path = process.env.HTTP_PATH;
const accessToken = process.env.DATABRICKS_TOKEN;
const clientID = process.env.DATABRICKS_OAUTH_CLIENT_ID;
const clientSecret = process.env.DATABRICKS_OAUTH_CLIENT_SECRET;

if (!server_hostname || !http_path) {
  throw new Error(
    "Missing required environment variables: HOSTNAME, HTTP_PATH",
  );
}

const dbsqlClient = new DBSQLClient();

// Prefer a Personal Access Token when provided; otherwise use OAuth M2M.
const buildOptions = (): ConnectionOptions => {
  if (accessToken) {
    return {
      host: server_hostname,
      path: http_path,
      authType: "access-token",
      token: accessToken,
    };
  }

  if (!clientID || !clientSecret) {
    throw new Error(
      "Missing Databricks credentials: set DATABRICKS_TOKEN, or DATABRICKS_OAUTH_CLIENT_ID and DATABRICKS_OAUTH_CLIENT_SECRET",
    );
  }

  return {
    host: server_hostname,
    path: http_path,
    authType: "databricks-oauth",
    oauthClientId: clientID,
    oauthClientSecret: clientSecret,
    useDatabricksOAuthInAzure: true,
  };
};

const options: ConnectionOptions = buildOptions();

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

export const runQuery = async <T extends object = object[]>(
  query: string,
  parameters: QueryParameters = {},
): Promise<T> => {
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
    return result as T;
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
