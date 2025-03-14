import type {
  $Fetch,
  ExtractedRouteMethod,
  NitroFetchOptions,
  NitroFetchRequest,
  TypedInternalResponse,
} from "nitropack/types";

interface DropFetch<
  DefaultT = unknown,
  DefaultR extends NitroFetchRequest = NitroFetchRequest
> {
  <
    T = DefaultT,
    R extends NitroFetchRequest = DefaultR,
    O extends NitroFetchOptions<R> = NitroFetchOptions<R>
  >(
    request: R,
    opts?: O
  ): Promise<
    // @ts-ignore
    TypedInternalResponse<
      R,
      T,
      NitroFetchOptions<R> extends O ? "get" : ExtractedRouteMethod<R, O>
    >
  >;
}

export const $dropFetch: DropFetch = async (request, opts) => {
  if (!getCurrentInstance()?.proxy) {
    return (await $fetch(request, opts)) as any;
  }
  const { data, error } = await useFetch(request, opts as any);
  if (error.value) throw error.value;
  return data.value as any;
};
