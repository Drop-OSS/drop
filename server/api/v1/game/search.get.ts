export default defineEventHandler(async (h3) => {
    const query = getQuery(h3);
    const search = query["q"]?.toString();
    if (!search) throw createError({
        statusCode: 400,
        statusMessage: "Missing search param"
    });

    const results = await h3.context.metadataHandler.search(search);

    return results;
});