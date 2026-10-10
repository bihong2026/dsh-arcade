// GameHub Arcade 的宿主半。
//
// 游戏中心在浏览器端的沙箱 iframe 里跑，宿主半负责三件事：
//   1. /gamehub-arcade/ping —— 探活 + 版本自检 + 把前端该用的地址发给它；
//   2. /gamehub-arcade/site —— 返回游戏中心站点地址（cordis.patch.yml 的 siteBase 可覆盖）；
//   3. /gamehub-arcade/site/* —— 把站点（含 /games/ 下的全部游戏镜像）整段反代到同源。
//
// 反代是必需的，不是可选优化：DSH 桌面端页面在 dsh-app:// 安全上下文里，前端 iframe
// 直连 http:// 站点会被浏览器判为混合内容直接拦掉（表现为整页黑屏、控制台才有报错）。
// 走宿主同源反代后 iframe 用的是相对路径，不涉及跨协议也不涉及跨域。
//
// 插件设置（cordis.patch.yml 的 config）只放默认值：siteBase 游戏中心站点地址。
// 装好之后不改也能玩；改了要重启应用生效。

import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";

export const name = "gamehub-arcade";

export const inject = ["webServer"];

export const ROUTE_BASE = "/gamehub-arcade";
export const ACTIONS = ["ping", "site"];

/** 站点反代前缀：这一整段（含子路径）转到游戏中心站点。 */
export const SITE_PREFIX = `${ROUTE_BASE}/site`;

/** 游戏中心站点默认地址：仓库作者公网部署的那一份，94 款游戏全量自托管。 */
export const DEFAULT_SITE_BASE = "http://122.51.206.118/";

/** 前端 iframe 实际用的地址：同源反代前缀（不是站点原始地址）。 */
export const EMBED_PATH = `${SITE_PREFIX}/`;

/** 反代超时：超了当站点不可达，给前端一句人话。 */
export const PROXY_TIMEOUT_MS = 15000;

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
	/** 探活 + 版本自检 + 把前端该用的地址发给它。 */
	ping: async (ctx, config) => ({
		ok: true,
		game: "gamehub-arcade",
		embed: EMBED_PATH,
		config: resolveConfig(config)
	}),

	/** 游戏中心站点地址（站点本体 + /games/ 下的全部游戏镜像都在同一台服务器）。 */
	site: async (ctx, config) => ({ ok: true, site: resolveConfig(config).siteBase, embed: EMBED_PATH })
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
 * 把 /gamehub-arcade/site/<x> 原样转给游戏中心站点，流式回传（含 HTML/CSS/JS/图片/游戏资源）。
 * 站点内所有引用都是相对路径，所以反代不需要改写任何内容。
 */
export async function proxySite(req, res, siteBase = DEFAULT_SITE_BASE) {
	const url = new URL(req.url ?? "/", "http://dsh.invalid");
	const tail = url.pathname.startsWith(SITE_PREFIX) ? url.pathname.slice(SITE_PREFIX.length) : url.pathname;
	const path = tail === "" ? "/" : tail;
	const target = `${siteBase.replace(/\/+$/, "")}${path}${url.search}`;

	await new Promise((resolve) => {
		let done = false;
		const finish = () => { if (!done) { done = true; resolve(); } };

		const upstream = httpRequest(
			target,
			{ method: req.method, headers: { accept: String(req.headers.accept || "*/*") }, timeout: PROXY_TIMEOUT_MS },
			(ur) => {
				res.writeHead(ur.statusCode || 502, {
					"content-type": String(ur.headers["content-type"] || "application/octet-stream"),
					"cache-control": "no-store"
				});
				ur.pipe(res);
				ur.on("end", finish);
				ur.on("error", finish);
				res.on("close", finish);
			}
		);
		upstream.on("error", (error) => {
			if (!res.headersSent) {
				res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({ ok: false, message: `连不上游戏中心站点（${target}）：${String(error && error.message || error)}` }));
			}
			finish();
		});
		upstream.on("timeout", () => { upstream.destroy(new Error("站点响应超时")); });
		upstream.end();
	});
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
	const site = resolveConfig(config).siteBase;

	// 站点反代（前缀匹配，子路径原样带过去）：iframe 走同源，绕开混合内容拦截。
	registerRoute(ctx, SITE_PREFIX, async (req, res) => {
		try {
			await proxySite(req, res, site);
		} catch (error) {
			ctx.logger?.warn?.(error instanceof Error ? error : new Error(String(error)));
			if (!res.headersSent) {
				res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({ ok: false, message: `站点反代失败：${String(error)}` }));
			}
		}
	}, "prefix");

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
