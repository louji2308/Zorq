import type { Server } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Express } from "express";

export interface RunningServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startServer(app: Express): Promise<RunningServer> {
  const server: Server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}
