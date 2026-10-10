// GameHub Arcade 的浏览器半。
//
// 它占两个官方插槽（同一个 id 串起来），不改任何官方文件：
//   - sidebar.panellist：在侧栏加一项「游戏」（id = gamehub-arcade）
//   - 布局 root 的 keyed main：点侧栏那一项打开的整页（iframe 装载游戏中心）
//
// 写法对照 plugins/tank-battle（可正常挂侧栏的参考实现）：
//   - inject: ["slots", "layout"]，用 ctx.slots.inject(name, register) 两段式注册；
//   - sidebar.panellist 的 id 与 cordis.patch.yml 里 insert 的 id 一致，main 的 key 同 id。
//
// 游戏中心本体是一个独立站点（默认 http://122.51.206.118/，94 款游戏全量自托管），
// 这里只是沙箱 iframe 嵌入。

window.__ModuleLoader__.load({
	id: "@gamehub/dsh-arcade",
	factory(require) {
		const React = require("react");
		const h = React.createElement;

		/** 侧栏那一项与整页共用同一个 id，改这里两处一起改（cordis.patch.yml 的 insert id 同步改）。 */
		const PANEL_ID = "gamehub-arcade";
		/** 游戏中心站点地址。末尾斜杠在 view 里统一剪掉再补一个。 */
		const SITE_BASE = "http://122.51.206.118/";

		/** 整页：把游戏中心站点用沙箱 iframe 装满。 */
		function ArcadePage() {
			const base = SITE_BASE.replace(/\/+$/, "/");
			return h("iframe", {
				src: base,
				title: "GameHub Arcade",
				allow: "fullscreen; autoplay; gamepad",
				// 沙箱刻意放宽：游戏中心与 DSH 跨源，iframe 内的脚本碰不到宿主数据。
				sandbox: "allow-scripts allow-same-origin allow-pointer-lock allow-popups allow-forms allow-modals allow-orientation-lock allow-presentation allow-downloads",
				style: { flex: 1, border: "0", width: "100%", height: "100%", background: "var(--dsw-alias-bg-primary, #0b0e14)" }
			});
		}

		/** 侧栏图标：手柄，描边风格，颜色跟 currentColor。 */
		function GamesIcon() {
			return h(
				"svg",
				{
					width: "1em", height: "1em", viewBox: "0 0 24 24", fill: "none",
					stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round"
				},
				h("path", { key: "d", d: "M6 12h4m-2-2v4m7-3h.01M18 13h.01" }),
				h("path", {
					key: "p",
					d: "M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"
				})
			);
		}

		return {
			inject: ["slots", "layout"],
			apply(ctx) {
				// 整页：key 与侧栏那一项同 id，官方布局靠这个 id 把两者对上。
				ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: PANEL_ID }, ArcadePage));
				// 侧栏菜单项。
				ctx.slots.inject("sidebar.panellist", () => ctx.slots.register(
					{ name: "sidebar.panellist", id: PANEL_ID, order: 7, label: "游戏" },
					GamesIcon
				));
			}
		};
	}
});
