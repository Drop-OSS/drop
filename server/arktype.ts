import { ArkErrors } from "arktype";
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
  const body = await readBody(event);
  try {
    // Delete all values that are 'null'
    if (typeof body === "object" && !Array.isArray(body) && body !== null) {
      for (const [key, value] of Object.entries(body) as Array<
        [string, unknown]
      >) {
        if (value === null) {
          // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
          delete body[key];
        }
      }
    }
    return validate(body);
  } catch (e) {
    const t = await useTranslation(event);

    if (e instanceof ArkErrors) {
      throw createError({
        statusCode: 400,
        message: t("errors.invalidBody", [e.summary]),
      });
    }
    throw createError({
      statusCode: 400,
      message: t("errors.invalidBody", [
        e instanceof Error ? e.message : `${e}`,
      ]),
    });
  }
}
