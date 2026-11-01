import {
  createError,
  defineEventHandler,
  getQuery,
  getRequestHeader,
} from "h3";
import { discoverEaLibrary } from "../../../../utils/ea/library";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  // Same token-acquisition model as the Epic library handler: caller-supplied
  // via query parameter or Authorization header, never stored here.
  const token =
    (typeof query.token === "string" ? query.token : undefined) ??
    getRequestHeader(event, "authorization")?.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: "An EA access token is required",
    });
  }

  const title =
    typeof query.title === "string" ? query.title.trim() : undefined;
  const search =
    typeof query.search === "string" ? query.search.trim() : undefined;

  return discoverEaLibrary(token, { title, search });
});
