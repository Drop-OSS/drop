import type {
  ExtractedRouteMethod,
  NitroFetchOptions,
  NitroFetchRequest,
  TypedInternalResponse,
} from "nitropack/types";
import type { FetchError } from "ofetch";

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
    opts?: O & { failTitle?: string },
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

export const $dropFetch: DropFetch = async (rawRequest, opts) => {
  const requestParts = rawRequest.toString().split("/");
  requestParts.forEach((part, index) => {
    if (!part.startsWith(":")) {
      return;
    }
    const partName = part.slice(1);
    const replacement = opts?.params?.[partName] as string | undefined;
    if (!replacement) {
      return;
    }
    requestParts[index] = replacement;

    delete opts?.params?.[partName];
  });
  const request = requestParts.join("/");

  // If not in setup
  if (!getCurrentInstance()?.proxy) {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore Excessive stack depth comparing types
      return await $fetch(request, opts);
    } catch (e) {
      if (import.meta.client && opts?.failTitle) {
        console.warn(e);
        createModal(
          ModalType.Notification,
          {
            title: opts.failTitle,
            description:
              (e as FetchError)?.statusMessage ?? (e as string).toString(),
            buttonText: $t("common.close"),
          },
          (_, c) => c(),
        );
      }
      throw e;
    }
  }

  const id = request.toString();

  const state = useState(id);
  if (state.value) {
    // Deep copy
    const object = JSON.parse(JSON.stringify(state.value));
    // Never use again on client
    if (import.meta.client) state.value = undefined;
    return object;
  }

  const headers = useRequestHeaders(["cookie", "authorization"]);
  const data = await $fetch(request, {
    ...opts,
    headers: { ...headers, ...opts?.headers },
  });
  if (import.meta.server) state.value = data;
  return data;
};
