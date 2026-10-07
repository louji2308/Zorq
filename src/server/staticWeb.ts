import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import express, { type Express, type RequestHandler } from "express";
import { ApiError } from "../shared/errors.js";

export const DEFAULT_WEB_DIR = "dist/web";

export const STATIC_BUILD_MISSING_MESSAGE =
  "Static web build is missing (dist/web/index.html). Run npm run build before starting the production server.";

export function resolveWebDirPath(webDir: string): string {
  return resolve(process.cwd(), webDir);
}

export function webIndexPath(webDir: string): string {
  return join(webDir, "index.html");
}

function isHashedAsset(filePath: string): boolean {
  return filePath.includes(`${sep}assets${sep}`);
}

function spaFallback(indexPath: string): RequestHandler {
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    const path = req.path;
    if (path === "/api" || path.startsWith("/api/") || path === "/healthz") {
      next();
      return;
    }
    if (!existsSync(indexPath)) {
      next(new ApiError("SERVICE_UNAVAILABLE", STATIC_BUILD_MISSING_MESSAGE));
      return;
    }
    res.sendFile(indexPath, { headers: { "Cache-Control": "no-cache" } });
  };
}

export function mountStaticWeb(app: Express, webDir: string): void {
  app.use(
    express.static(webDir, {
      index: false,
      setHeaders: (res, filePath) => {
        res.setHeader(
          "Cache-Control",
          isHashedAsset(filePath) ? "public, max-age=31536000, immutable" : "no-cache"
        );
      }
    })
  );
  app.use(spaFallback(webIndexPath(webDir)));
}
