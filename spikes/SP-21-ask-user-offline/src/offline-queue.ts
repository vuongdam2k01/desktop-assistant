import crypto from "node:crypto";
import type { SQLiteLedger, OfflineCommand } from "./ledger.js";

export interface SystemCard {
  id: string;
  type: "SYSTEM";
  category: "BACKEND_DISRUPTED" | "NETWORK_DOWN" | "CREDENTIAL_EXPIRED";
  title: string;
  description: string;
  action: string;
  isBlocking: boolean;
  autoDismiss: boolean;
  badge: boolean;
  active: boolean;
  createdAt: number;
}

export class LocalComposerService {
  private ledger: SQLiteLedger;
  private backendBaseUrl: string;
  public activeSystemCard: SystemCard | null = null;
  public emittedSystemCards: SystemCard[] = [];

  constructor(ledger: SQLiteLedger, backendBaseUrl = "http://127.0.0.1:3999") {
    this.ledger = ledger;
    this.backendBaseUrl = backendBaseUrl;
  }

  async submitCommand(commandText: string): Promise<{
    success: boolean;
    queuedOffline: boolean;
    commandId: string;
    systemCard: SystemCard | null;
  }> {
    const commandId = crypto.randomUUID();
    const idempotencyKey = `idemp-${commandId}`;
    const createdAt = Date.now();

    // Thử gửi trực tiếp lên backend
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);

      const res = await fetch(`${this.backendBaseUrl}/api/v1/commands/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commandId,
          commandText,
          idempotencyKey,
          createdAt,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        // Backend nhận thành công trực tiếp
        return {
          success: true,
          queuedOffline: false,
          commandId,
          systemCard: null,
        };
      }
      throw new Error(`Backend returned HTTP ${res.status}`);
    } catch (err: any) {
      // Backend không phản hồi / mất mạng / lỗi 503 -> Đẩy vào hàng chờ cục bộ (Phụ lục A.10 ca E8)
      const queuedCmd = this.ledger.enqueueOfflineCommand(commandText, idempotencyKey);

      // Phát sinh SYSTEM card báo trạng thái theo đúng Phụ lục A.2
      this.activeSystemCard = {
        id: crypto.randomUUID(),
        type: "SYSTEM",
        category: "BACKEND_DISRUPTED",
        title: "Backend gián đoạn",
        description: "Máy chủ đồng bộ đang tạm thời gián đoạn. Lệnh của bạn đã được lưu vào hàng chờ cục bộ và sẽ tự động gửi lại khi kết nối phục hồi.",
        action: "Mở app kiểm tra trạng thái kết nối mạng",
        isBlocking: false,
        autoDismiss: false,
        badge: true,
        active: true,
        createdAt: Date.now(),
      };
      this.emittedSystemCards.push(this.activeSystemCard);

      return {
        success: true, // Composer vẫn nhận thành công lệnh của người dùng
        queuedOffline: true,
        commandId: queuedCmd.id,
        systemCard: this.activeSystemCard,
      };
    }
  }

  async syncQueue(): Promise<{ syncedCount: number; errors: any[] }> {
    // 1. Kiểm tra health check backend
    try {
      const res = await fetch(`${this.backendBaseUrl}/health`, { method: "GET" });
      if (!res.ok) {
        return { syncedCount: 0, errors: ["Backend unhealthy"] };
      }
    } catch (err) {
      return { syncedCount: 0, errors: ["Backend unreachable"] };
    }

    // 2. Lấy danh sách lệnh trong hàng chờ theo thứ tự FIFO nghiêm ngặt
    const queuedCommands = this.ledger.getQueuedCommands();
    let syncedCount = 0;
    const errors: any[] = [];

    for (const cmd of queuedCommands) {
      try {
        const sendRes = await fetch(`${this.backendBaseUrl}/api/v1/commands/intake`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            commandId: cmd.id,
            commandText: cmd.commandText,
            idempotencyKey: cmd.idempotencyKey,
            createdAt: cmd.createdAt,
          }),
        });

        if (sendRes.ok) {
          this.ledger.markCommandSynced(cmd.id);
          syncedCount++;
        } else {
          errors.push(`Failed to send command ${cmd.id}: HTTP ${sendRes.status}`);
        }
      } catch (err: any) {
        errors.push(`Error sending command ${cmd.id}: ${err.message}`);
      }
    }

    // Nếu hàng chờ đã được giải phóng hết, thu hồi SYSTEM card
    const remaining = this.ledger.getQueuedCommands();
    if (remaining.length === 0 && this.activeSystemCard) {
      this.activeSystemCard.active = false;
      this.activeSystemCard = null;
    }

    return { syncedCount, errors };
  }
}
