
// GameHub Arcade 客户端半的注册自检：不依赖浏览器，用假 ModuleLoader 跑 client.js，
// 断言它确实往 sidebar.panellist 与 main 两个插槽各注册了一项，且 id 对齐。
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// 假 React：只需要 createElement 能造出对象树，测试里不渲染。
const React = {
	createElement(tag, props, ...children) {
		return { tag, props: props || {}, children };
	}
};

let loaded = null;
globalThis.window = {
	__ModuleLoader__: {
		load(def) { loaded = def; }
	}
};

const src = readFileSync(new URL("../client.js", import.meta.url), "utf8");
// client.js 是浏览器脚本（顶层用 window），用间接 eval 在全局作用域跑。
(0, eval)(src);

const assert = (cond, msg) => { if (!cond) { console.error("FAIL: " + msg); process.exitCode = 1; } else { console.log("ok: " + msg); } };

assert(loaded && typeof loaded.factory === "function", "client.js 调用了 __ModuleLoader__.load");
assert(loaded.id === "@gamehub/dsh-arcade", "loader id = @gamehub/dsh-arcade");

const registered = [];
const slots = {
	inject(name, fn) { registered.push({ slot: name, entries: [] }); const e = registered[registered.length - 1]; const orig = slots.register; slots.register = (entry, comp) => { e.entries.push({ entry, comp }); return () => {}; }; fn(); slots.register = orig; },
	register() { throw new Error("register 未经 inject 调用"); }
};
const fakeCtx = { slots };
const mod = loaded.factory((id) => { if (id === "react") return React; throw new Error("unexpected require: " + id); });
assert(Array.isArray(mod.inject), "模块导出了 inject 数组");
assert(mod.inject.includes("slots"), "inject 含 slots");
assert(mod.inject.includes("layout"), "inject 含 layout");
mod.apply(fakeCtx);

const mainSlot = registered.find((r) => r.slot === "main");
const sideSlot = registered.find((r) => r.slot === "sidebar.panellist");
assert(mainSlot && mainSlot.entries.length === 1, "main 插槽注册 1 项");
assert(sideSlot && sideSlot.entries.length === 1, "sidebar.panellist 注册 1 项");

const panelId = sideSlot.entries[0].entry.id;
const mainKey = mainSlot.entries[0].entry.key;
assert(panelId === "gamehub-arcade", "侧栏 id = gamehub-arcade");
assert(mainKey === panelId, "main.key 与侧栏 id 一致（" + mainKey + " = " + panelId + "）");
assert(sideSlot.entries[0].entry.label === "游戏", "侧栏 label = 游戏");
assert(typeof sideSlot.entries[0].comp === "function", "侧栏图标是组件");
assert(typeof mainSlot.entries[0].comp === "function", "整页是组件");

// cordis.patch.yml 的 insert id 必须与前端 PANEL_ID 一致
const patch = readFileSync(new URL("../cordis.patch.yml", import.meta.url), "utf8");
const m = patch.match(/-\s*insert:\s*\n\s*-\s*id:\s*(\S+)/);
assert(m && m[1] === panelId, "cordis.patch.yml insert id = " + panelId + "（实际 " + (m && m[1]) + "）");

// package.json 的 dsh.client.inject 必须含 layout 与 sidebar 两个包
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const inj = (pkg.dsh && pkg.dsh.client && pkg.dsh.client.inject) || [];
assert(inj.includes("@deepseek-ai/dsh-client-ui-layout"), "package.json inject 含 ui-layout");
assert(inj.includes("@deepseek-ai/dsh-client-ui-sidebar"), "package.json inject 含 ui-sidebar");
assert(!pkg.scripts || !pkg.scripts.prepare, "没有 prepare 脚本（pnpm10 git 安装前提）");

console.log(process.exitCode ? "\nSELF-CHECK FAILED" : "\nSELF-CHECK PASSED");
