export function queryParamBuilder(params: { [key: string]: string }) {
  const list = Object.entries(params).map(
    ([key, value]) => `${key}=${encodeURIComponent(value)}`,
  );
  const str = list.join("&");
  return str;
}
