import { ArkErrors, type } from "arktype";
import { configure } from "arktype/config";
import type { H3Event } from "h3";

export const throwingArktype = configure({
  onFail: (errors) => errors.throw(),
  actual: () => "",
});

// be sure to specify both the runtime and static configs

declare global {
  interface ArkEnv {
    onFail: typeof throwingArktype.onFail;
  }
}

export async function readDropValidatedBody<T>(
  event: H3Event,
  validate: (data: object) => T,
): Promise<T> {
  const _body = await readBody(event);
  try {
    return validate(_body);
  } catch (e) {
    if (e instanceof ArkErrors) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid request body: ${e.summary}`,
      });
    }
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid request body: ${e}`,
    });
  }
}
