import type { APIEndpoint, APIMethod, Endpoints } from "./types";

type BodyOf<
  Path extends Endpoints,
  Method extends APIMethod<Path>,
> = APIEndpoint<Path>[Method] extends { body: infer Body } ? Body : never;

type ResponseOf<
  Path extends Endpoints,
  Method extends APIMethod<Path>,
> = APIEndpoint<Path>[Method] extends { response: infer Response }
  ? Response
  : never;

type ApiFetchOptions<Path extends Endpoints, Method extends APIMethod<Path>> = {
  method: Method;
  signal?: AbortSignal;
} & (APIEndpoint<Path>[Method] extends { body: unknown }
  ? { body: BodyOf<Path, Method> }
  : { body?: never });

export async function apiFetch<
  Path extends Endpoints,
  Method extends APIMethod<Path>,
>(
  path: Path,
  options: ApiFetchOptions<Path, Method>,
): Promise<ResponseOf<Path, Method>> {
  const response = await fetch(path, {
    method: String(options.method),
    headers: {
      "Content-Type": "application/json",
    },
    body:
      "body" in options && options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
    signal: options.signal,
  });

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch {
    throw new Error(`API response from "${path}" is not valid JSON.`);
  }

  if (!response.ok) {
    const errorMessage =
      typeof responseBody === "object" &&
      responseBody !== null &&
      "error" in responseBody &&
      typeof responseBody.error === "string"
        ? responseBody.error
        : "Unknown error";

    throw new Error(`API request failed: ${errorMessage}`);
  }

  return responseBody as ResponseOf<Path, Method>;
}
