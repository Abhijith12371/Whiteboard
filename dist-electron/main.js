import { BrowserWindow as e, app as t } from "electron";
import n from "node:path";
import { fileURLToPath as r } from "node:url";
//#region electron/main.ts
var i = n.dirname(r(import.meta.url));
process.env.APP_ROOT = n.join(i, "..");
var a = process.env.VITE_DEV_SERVER_URL, o = n.join(process.env.APP_ROOT, "dist-electron"), s = n.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = a ? n.join(process.env.APP_ROOT, "public") : s, t.commandLine.appendSwitch("disable-gpu-sandbox"), t.commandLine.appendSwitch("no-sandbox"), t.commandLine.appendSwitch("disable-web-security");
var c;
function l() {
	c = new e({
		width: 1280,
		height: 800,
		minWidth: 900,
		minHeight: 600,
		titleBarStyle: "hidden",
		titleBarOverlay: {
			color: "#ffffff",
			symbolColor: "#09090b",
			height: 40
		},
		webPreferences: {
			preload: n.join(i, "preload.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1,
			sandbox: !1
		}
	}), a && c.webContents.openDevTools({ mode: "detach" }), c.webContents.on("did-finish-load", () => {
		c?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
	}), a ? c.loadURL(a) : c.loadFile(n.join(s, "index.html"));
}
t.on("window-all-closed", () => {
	process.platform !== "darwin" && (t.quit(), c = null);
}), t.on("activate", () => {
	e.getAllWindows().length === 0 && l();
}), t.whenReady().then(l);
//#endregion
export { o as MAIN_DIST, s as RENDERER_DIST, a as VITE_DEV_SERVER_URL };
