// GameHub Arcade 的宿主半。
//
// 游戏中心在浏览器端（iframe 加载独立站点），宿主半只提供：
//   1. /gamehub-arcade/ping —— 探活 + 版本自检 + 把站点地址发给前端；
//   2. /gamehub-arcade/site —— 返回游戏中心站点地址（cordis.patch.yml 的 siteBase 可覆盖）。
//
// 插件设置（cordis.patch.yml 的 config）只放默认值：siteBase 游戏中心站点地址。
// 装好之后不改也能玩；改了要重启应用生效。

export const name = "gamehub-arcade";

export const inject = ["webServer"];

export const ROUTE_BASE = "/gamehub-arcade";
export const ACTIONS = ["ping", "site"];

/** 游戏中心站点默认地址：仓库作者公网部署的那一份，94 款游戏全量自托管。 */
export const DEFAULT_SITE_BASE = "http://122.51.206.118/";

/** 插件设置里能改的键。 */
export const CONFIG_KEYS = ["siteBase"];

export const DEFAULTS = {
	siteBase: DEFAULT_SITE_BASE
};

/** 插件版本从本包 package.json 读，前端半自检用它对版本。 */
export const VERSION = readOwnVersion();

function readOwnVersion() {
	try {
		const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
		return typeof manifest.version === "string" ? manifest.version : "";
	} catch {
		return "";
	}
}

import { readFileSync } from "node:fs";

/**
 * 把插件设置收拾成确定的值。返回对象必须带齐 CONFIG_KEYS 里的每一个键 ——
 * 漏一个的话 config.<key> 会静默为 undefined。
 */
export function resolveConfig(config) {
	const raw = config && typeof config === "object" ? config : {};
	const base = String(raw.siteBase ?? "").trim();
	return {
		siteBase: base === "" ? DEFAULTS.siteBase : base.replace(/\/+$/, "/")
	};
}

export const handlers = {
	/** 探活 + 版本自检 + 把站点地址发给前端。 */
	ping: async (ctx, config) => ({ ok: true, game: "gamehub-arcade", config: resolveConfig(config) }),

	/** 游戏中心站点地址。 */
	site: async (ctx, config) => ({ ok: true, site: resolveConfig(config).siteBase })
};

function sendJson(res, status, payload) {
	const text = JSON.stringify(payload);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store",
		"content-length": Buffer.byteLength(text)
	});
	res.end(text);
}

/**
 * 注册一条同源路由。注册失败（热重载时旧实例的路由还没摘掉，报 duplicate route）
 * 只影响这一条，不能让后面几条一起不注册，所以每条自带 try/catch。
 */
function registerRoute(ctx, path, handler, kind = "exact") {
	ctx.effect(
		() => {
			try {
				return ctx.webServer.register({ kind, path, handler });
			} catch (error) {
				ctx.logger?.warn?.(error instanceof Error ? error : new Error(String(error)));
				return () => {};
			}
		},
		`gamehub-arcade: ${path}`
	);
}

export function apply(ctx, config) {
	for (const action of ACTIONS) {
		const path = `${ROUTE_BASE}/${action}`;
		registerRoute(ctx, path, async (req, res) => {
			try {
				const payload = await handlers[action](ctx, config);
				sendJson(res, 200, { ...payload, hostVersion: VERSION });
			} catch (error) {
				ctx.logger?.warn?.(error instanceof Error ? error : new Error(String(error)));
				sendJson(res, 200, { ok: false, message: String(error), hostVersion: VERSION });
			}
		});
	}
}
