import prisma from "~/server/internal/db/database";
import objectHandler from "~/server/internal/objects";

type FieldReferenceMap = {
  [modelName: string]: {
    model: unknown; // Prisma model
    fields: string[]; // Fields that may contain IDs
    arrayFields: string[]; // Fields that are arrays that may contain IDs
  };
};

export default defineTask({
  meta: {
    name: "cleanup:objects",
  },
  async run() {
    console.log("[Task cleanup:objects]: Cleaning unreferenced objects");

    const objects = await objectHandler.listAll();
    console.log(
      `[Task cleanup:objects]: searching for ${objects.length} objects`,
    );
    console.log(objects);
    const results = await findUnreferencedStrings(objects, buildRefMap());
    console.log("[Task cleanup:objects]: Unreferenced objects: ", results);

    console.log("[Task cleanup:objects]: Done");
    return { result: true };
  },
});

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

async function isReferencedInModelFields(
  id: string,
  fieldRefMap: FieldReferenceMap,
): Promise<boolean> {
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
