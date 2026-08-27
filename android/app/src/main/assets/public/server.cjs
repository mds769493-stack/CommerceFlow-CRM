var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  createServer: () => createServer
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_vite = require("vite");
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_meta = {};
import_dotenv.default.config();
var currentFilename = typeof import_url.fileURLToPath === "function" && import_meta.url ? (0, import_url.fileURLToPath)(import_meta.url) : typeof __filename !== "undefined" ? __filename : "";
var currentDirname = typeof __dirname !== "undefined" ? __dirname : currentFilename ? import_path.default.dirname(currentFilename) : process.cwd();
async function createServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use((req, res, next) => {
    console.log(`${(/* @__PURE__ */ new Date()).toISOString()} - ${req.method} ${req.url}`);
    next();
  });
  app.use(import_express.default.json());
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
  });
  let cachedToken = null;
  let refreshToken = null;
  let tokenExpiry = 0;
  async function getPathaoToken() {
    const currentTime = Math.floor(Date.now() / 1e3);
    if (cachedToken && tokenExpiry > currentTime + 120) {
      return cachedToken;
    }
    const baseUrl = process.env.PATHAO_BASE_URL || "https://courier-api-sandbox.pathao.com";
    const clientId = process.env.PATHAO_CLIENT_ID;
    const clientSecret = process.env.PATHAO_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Missing Pathao API credentials (CLIENT_ID or CLIENT_SECRET)");
    }
    let response;
    if (refreshToken) {
      console.log("Refreshing Pathao access token...");
      response = await fetch(`${baseUrl}/aladdin/api/v1/issue-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: refreshToken
        })
      });
    }
    if (!response || !response.ok) {
      console.log("Issuing new Pathao access token via password grant...");
      const username = process.env.PATHAO_USERNAME;
      const password = process.env.PATHAO_PASSWORD;
      if (!username || !password) {
        throw new Error("Missing Pathao API credentials (USERNAME or PASSWORD)");
      }
      response = await fetch(`${baseUrl}/aladdin/api/v1/issue-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          username,
          password,
          grant_type: "password"
        })
      });
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Pathao Auth Failed: ${response.status} ${JSON.stringify(errorData)}`);
    }
    const data = await response.json();
    cachedToken = data.access_token;
    refreshToken = data.refresh_token || refreshToken;
    tokenExpiry = currentTime + data.expires_in;
    return cachedToken;
  }
  app.get("/api/order-info/:consignment_id", async (req, res) => {
    const { consignment_id } = req.params;
    const baseUrl = process.env.PATHAO_BASE_URL || "https://courier-api-sandbox.pathao.com";
    try {
      const token = await getPathaoToken();
      const response = await fetch(`${baseUrl}/aladdin/api/v1/orders/${consignment_id}/info`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const contentType = response.headers.get("content-type");
      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: "Non-JSON response received from Pathao", raw: text };
      }
      res.status(response.status).json(data);
    } catch (error) {
      console.error("Pathao API Proxy Error:", error.message);
      res.status(500).json({
        error: "Failed to communicate with Pathao API",
        details: error.message
      });
    }
  });
  app.get("/api/order-info-by-order-id/:order_id", async (req, res) => {
    const { order_id } = req.params;
    if (!order_id || order_id === "undefined") {
      return res.status(400).json({ error: "Invalid Order ID provided" });
    }
    const baseUrl = process.env.PATHAO_BASE_URL || "https://courier-api-sandbox.pathao.com";
    try {
      const token = await getPathaoToken();
      const response = await fetch(`${baseUrl}/aladdin/api/v1/orders?merchant_order_id=${order_id}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const contentType = response.headers.get("content-type");
      let result;
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        result = { message: "Non-JSON response received from Pathao", raw: text };
      }
      if (result.type === "success" && result.data && result.data.length > 0) {
        res.status(200).json({
          type: "success",
          data: result.data[0]
        });
      } else {
        res.status(404).json({
          error: "Not Found",
          details: `Order [${order_id}] was not found in Pathao's system. Please check the ID or try again later.`
        });
      }
    } catch (error) {
      console.error("Pathao API Proxy Error (by Order ID):", error.message);
      res.status(500).json({
        error: "Failed to communicate with Pathao API",
        details: error.message
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.use("/api", (req, res) => {
    res.status(404).json({
      error: "API endpoint not found",
      path: req.originalUrl
    });
  });
  return app;
}
async function startServer() {
  try {
    const app = await createServer();
    const PORT = 3e3;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}
startServer();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createServer
});
//# sourceMappingURL=server.cjs.map
