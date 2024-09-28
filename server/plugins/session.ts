import session from "../internal/session";

export default defineNitroPlugin((nitro) => {
    nitro.hooks.hook('request', (h3) => {
        h3.context.session = session;
    })
});