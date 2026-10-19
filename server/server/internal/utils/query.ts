export function queryParamBuilder(params: {
  [key: string]: string | undefined;
}) {
  const list = Object.entries(params)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
  const str = list.join("&");
  return str;
}
