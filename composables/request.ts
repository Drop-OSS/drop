import type {
  ExtractedRouteMethod,
  NitroFetchOptions,
  NitroFetchRequest,
  TypedInternalResponse,
} from "nitropack/types";

interface DropFetch<
  DefaultT = unknown,
  DefaultR extends NitroFetchRequest = NitroFetchRequest,
> {
  <
    T = DefaultT,
    R extends NitroFetchRequest = DefaultR,
    O extends NitroFetchOptions<R> = NitroFetchOptions<R>,
  >(
    request: R,
    opts?: O,
  ): Promise<
    // sometimes there is an error, other times there isn't
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
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
    return await $fetch(request, opts);
  }
  const id = request.toString();

  const state = useState(id);
  if (state.value) {
    // Deep copy
    const object = JSON.parse(JSON.stringify(state.value));
    // Never use again on client
    state.value = undefined;
    return object;
  }

  const headers = useRequestHeaders(["cookie", "authorization"]);
  const data = await $fetch(request, {
    ...opts,
    headers: { ...opts?.headers, ...headers },
  });
  if (import.meta.server) state.value = data;
  return data;
};
