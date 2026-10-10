// GameHub Arcade — DSH client entry (web profile).
// React is provided by the DSH web client via the ModuleLoader `require`
// (marked external at build time, same as reference community plugins).
import React from "react";

const GAMEHUB_URL = window.__GAMEHUB_URL__ || "http://122.51.206.118/";
const PLUGIN_TAB_ID = "@gamehub/dsh-arcade:arcade";

function ArcadeView() {
  return React.createElement("iframe", {
    src: GAMEHUB_URL,
    title: "GameHub Arcade",
    allow: "fullscreen; autoplay; gamepad",
    // Sandbox is intentionally permissive for third-party game compatibility;
    // the iframe is cross-origin to game hosts so they stay isolated from DSH.
    sandbox: "allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms allow-modals allow-orientation-lock allow-presentation allow-downloads",
    style: {
      flex: 1,
      border: "0",
      width: "100%",
      height: "100%",
      background: "var(--dsw-alias-bg-primary, #0b0e14)",
    },
  });
}

export const name = "@gamehub/dsh-arcade";
export const inject = ["client-ui-slots", "locale"];

export function apply(ctx) {
  const slots = ctx.get?.("client-ui-slots") ?? ctx["client-ui-slots"];

  ctx.effect(() => {
    if (!slots?.register) {
      console.warn("gamehub-arcade: client-ui-slots service not available");
      return;
    }
    // Register the "游戏" tab in the DSH sidebar; clicking it shows the
    // GameHub Arcade launcher (full catalog, search, player) in an iframe.
    return slots.register({
      id: PLUGIN_TAB_ID,
      title: "游戏",
      icon: "🎮",
      order: 90,
      component: () => React.createElement(ArcadeView),
    });
  }, "@gamehub/dsh-arcade: sidebar tab");

  console.log("gamehub-arcade: client ready");
}
