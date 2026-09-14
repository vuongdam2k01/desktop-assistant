import http from "node:http";

export interface ReceivedCommand {
  commandId: string;
  commandText: string;
  idempotencyKey: string;
  createdAt: number;
  receivedAt: number;
}

export class BackendStubServer {
  private server: http.Server | null = null;
  public port: number;
  public receivedCommands: ReceivedCommand[] = [];
  public seenIdempotencyKeys = new Set<string>();
  public isRunning = false;
  public simulate503 = false;

  constructor(port = 3999) {
    this.port = port;
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        if (this.simulate503) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Service Temporarily Unavailable" }));
          return;
        }

        if (req.method === "GET" && req.url === "/health") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
          return;
        }

        if (req.method === "POST" && req.url === "/api/v1/commands/intake") {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => {
            try {
              const data = JSON.parse(body);
              const { commandId, commandText, idempotencyKey, createdAt } = data;

              // Kiểm tra chống trùng (Idempotency)
              if (this.seenIdempotencyKeys.has(idempotencyKey)) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    status: "deduplicated",
                    idempotencyKey,
                    message: "Command already received. Duplicate ignored.",
                  })
                );
                return;
              }

              this.seenIdempotencyKeys.add(idempotencyKey);
              const record: ReceivedCommand = {
                commandId,
                commandText,
                idempotencyKey,
                createdAt,
                receivedAt: Date.now(),
              };
              this.receivedCommands.push(record);

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ status: "accepted", commandId, receivedCount: this.receivedCommands.length }));
            } catch (err: any) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid JSON body" }));
            }
          });
          return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
      });

      this.server.listen(this.port, () => {
        this.isRunning = true;
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.isRunning = false;
          this.server = null;
          resolve();
        });
      } else {
        this.isRunning = false;
        resolve();
      }
    });
  }

  clear() {
    this.receivedCommands = [];
    this.seenIdempotencyKeys.clear();
  }
}
