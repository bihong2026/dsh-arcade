// GameHub Arcade — DSH plugin host entry.
// Registers the plugin identity and (optionally) a health API route.
// The client bundle registers the sidebar tab via dsh-client-ui-slots.

const name = "@gamehub/dsh-arcade";

const inject = ["webServer"];

function apply(ctx) {
  const webServer = ctx.get?.("webServer") ?? ctx.webServer;

  ctx.effect(() => {
    if (!webServer?.register) return;
    const route = {
      kind: "prefix",
      path: "/gamehub-arcade/api",
      handler: async (req, res) => {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, plugin: name, version: "0.1.0" }));
      },
    };
    return webServer.register(route);
  }, "@gamehub/dsh-arcade: api route");

  console.log("gamehub-arcade: host ready");
}

export { apply, inject, name };
