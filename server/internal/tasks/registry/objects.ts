import prisma from "~/server/internal/db/database";
import objectHandler from "~/server/internal/objects";
import { defineDropTask } from "..";

type FieldReferenceMap = {
  [modelName: string]: {
    model: unknown; // Prisma model
    fields: string[]; // Fields that may contain IDs
    arrayFields: string[]; // Fields that are arrays that may contain IDs
  };
};

export default defineDropTask({
  buildId: () => `cleanup:objects:${new Date().toISOString()}`,
  name: "Cleanup Objects",
  acls: ["system:maintenance:read"],
  taskGroup: "cleanup:objects",
  async run({ progress, log }) {
    log("Cleaning unreferenced objects");

    // get all objects
    const objects = await objectHandler.listAll();
    log(`searching for ${objects.length} objects`);
    progress(30);

    // find unreferenced objects
    const refMap = buildRefMap();
    log("Building reference map");
    log(`Found ${Object.keys(refMap).length} models with reference fields`);
    log("Searching for unreferenced objects");
    const unrefedObjects = await findUnreferencedStrings(objects, refMap);
    log(`found ${unrefedObjects.length} Unreferenced objects`);
    // console.log(unrefedObjects);
    progress(60);

    // remove objects
    const deletePromises: Promise<boolean>[] = [];
    for (const obj of unrefedObjects) {
      log(`Deleting object ${obj}`);
      deletePromises.push(objectHandler.deleteAsSystem(obj));
    }
    await Promise.all(deletePromises);

    // Remove any possible leftover metadata
    objectHandler.cleanupMetadata();

    log("Done");
    progress(100);
  },
});

/**
 * Builds a map of Prisma models and their fields that may contain object IDs
 * @returns
 */
function buildRefMap(): FieldReferenceMap {
  const tables = Object.keys(prisma).filter(
    (v) => !(v.startsWith("$") || v.startsWith("_") || v === "constructor"),
  );
  // type test = Prisma.ModelName
  // prisma.game.fields.mIconId.

  const result: FieldReferenceMap = {};

  for (const model of tables) {
    // @ts-expect-error can't get model to typematch key names
    const fields = Object.keys(prisma[model]["fields"]);

    const single = fields.filter((v) => v.toLowerCase().endsWith("objectid"));
    const array = fields.filter((v) => v.toLowerCase().endsWith("objectids"));

    result[model] = {
      // @ts-expect-error im not dealing with this
      model: prisma[model],
      fields: single,
      arrayFields: array,
    };
  }

  return result;
}

/**
 * Searches all models for a given id in their fields
 * @param id
 * @param fieldRefMap
 * @returns
 */
async function isReferencedInModelFields(
  id: string,
  fieldRefMap: FieldReferenceMap,
): Promise<boolean> {
  // TODO: optimize the built queries
  // rn it runs a query for every id over each db table
  for (const { model, fields, arrayFields } of Object.values(fieldRefMap)) {
    const singleFieldOrConditions = fields
      ? fields.map((field) => ({
          [field]: {
            equals: id,
          },
        }))
      : [];
    const arrayFieldOrConditions = arrayFields
      ? arrayFields.map((field) => ({
          [field]: {
            has: id,
          },
        }))
      : [];

    // prisma.game.findFirst({
    //   where: {
    //     OR: [
    //       // single item
    //       {
    //         mIconId: {
    //           equals: "",
    //         },
    //       },
    //       // array
    //       {
    //         mImageCarousel: {
    //           has: "",
    //         },
    //       },
    //     ],
    //   },
    // });

    // @ts-expect-error using unknown because im not typing this mess omg
    const found = await model.findFirst({
      where: { OR: [...singleFieldOrConditions, ...arrayFieldOrConditions] },
    });

    if (found) return true;
  }

  return false;
}

/**
 * Takes a list of objects and checks if they are referenced in any model fields
 * @param objects
 * @param fieldRefMap
 * @returns
 */
async function findUnreferencedStrings(
  objects: string[],
  fieldRefMap: FieldReferenceMap,
): Promise<string[]> {
  const unreferenced: string[] = [];

  for (const obj of objects) {
    const isRef = await isReferencedInModelFields(obj, fieldRefMap);
    if (!isRef) unreferenced.push(obj);
  }

  return unreferenced;
}
