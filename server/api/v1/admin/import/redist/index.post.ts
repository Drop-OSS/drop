import { ArkErrors, type } from "arktype";
import aclManager from "~/server/internal/acls";
import { handleFileUpload } from "~/server/internal/utils/handlefileupload";
import * as jdenticon from "jdenticon";
import prisma from "~/server/internal/db/database";
import libraryManager from "~/server/internal/library";
import jsdom from "jsdom";
import DOMPurify from 'dompurify';

export const ImportRedist = type({
  library: "string",
  path: "string",

  name: "string",
  description: "string",

  "platform?": type({
    name: "string",
    icon: "string",
    fileExts: type("string").pipe.try((s) => JSON.parse(s), type("string[]")),
  }),
});

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:redist:new"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await handleFileUpload(h3, {}, ["internal:read"], 1);
  if (!body) throw createError({ statusCode: 400, message: "Body required." });

  const [[id], rawOptions, pull, , add] = body;

  const options = ImportRedist(rawOptions);
  if (options instanceof ArkErrors)
    throw createError({ statusCode: 400, message: options.summary });

  const valid = await libraryManager.checkUnimportedGamePath(
    options.library,
    options.path,
  );
  if (!valid)
    throw createError({
      statusCode: 400,
      message: "Invalid library or game.",
    });

  const icon = id ?? add(jdenticon.toPng(options.name, 512));

  let svgContent = "";
  if (options.platform) {
    // This logic is duplicated on the client to make viewing there possible. 
    // TODO?: refactor into a single function. Not totally sure if this is a good idea though,
    // because they do different things
    const dom = new jsdom.JSDOM(options.platform.icon);
    const svg = dom.window.document.getElementsByTagName("svg").item(0);
    if (!svg)
      throw createError({
        statusCode: 400,
        statusMessage: "No SVG in uploaded image.",
      });
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svgContent = DOMPurify.sanitize(svg.outerHTML, {USE_PROFILES: {svg: true, svgFilters: true}});
  }

  const redist = await prisma.redist.create({
    data: {
      libraryId: options.library,
      libraryPath: options.path,

      mName: options.name,
      mShortDescription: options.description,
      mIconObjectId: icon,

      platform: {
        ...(options.platform
          ? {
              create: {
                platformName: options.platform.name,
                iconSvg: svgContent,
                fileExtensions: options.platform.fileExts,
              },
            }
          : undefined),
      },
    },
  });

  await pull();

  return redist;
});
