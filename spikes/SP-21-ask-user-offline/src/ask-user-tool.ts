import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { SQLiteLedger, DecisionRecord } from "./ledger.js";

export const AskUserOptionSchema = Type.Object({
  id: Type.String({ description: "Định danh duy nhất của option (ví dụ: opt_yes, opt_no)" }),
  label: Type.String({ maxLength: 30, description: "Nhãn hiển thị trên nút (tối đa 30 ký tự)" }),
  description: Type.Optional(Type.String({ description: "Mô tả phụ giải thích chi tiết" })),
});

export const AskUserSchema = Type.Object({
  question: Type.String({ description: "1 câu hỏi duy nhất, gộp mọi ý còn thiếu (FR-AG-05)" }),
  options: Type.Optional(
    Type.Array(AskUserOptionSchema, {
      maxItems: 4,
      description: "0–4 lựa chọn nhanh cho người dùng",
    })
  ),
  allow_free_text: Type.Optional(
    Type.Boolean({
      default: true,
      description: "Cho phép người dùng gõ văn bản tự do ngoài các options (mặc định: true)",
    })
  ),
});

export type AskUserParams = {
  question: string;
  options?: Array<{ id: string; label: string; description?: string }>;
  allow_free_text?: boolean;
};

export type UserAnswer = {
  option_id?: string;
  text?: string;
};

export interface PendingAsk {
  jobId: string;
  toolCallId: string;
  params: AskUserParams;
  createdAt: number;
  timeoutMs: number;
  timer?: NodeJS.Timeout;
  resolve: (res: { answer: UserAnswer; source: "bubble" | "app" }) => void;
  reject: (err: any) => void;
}

export class AskUserManager {
  private pendingAsks = new Map<string, PendingAsk>();
  private ledger: SQLiteLedger;
  private defaultTimeoutMs: number;

  constructor(ledger: SQLiteLedger, defaultTimeoutMs = 30 * 60 * 1000) {
    this.ledger = ledger;
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  hasActiveAsk(jobId: string): boolean {
    return this.pendingAsks.has(jobId);
  }

  getActiveAsk(jobId: string): PendingAsk | undefined {
    return this.pendingAsks.get(jobId);
  }

  registerAsk(
    jobId: string,
    toolCallId: string,
    params: AskUserParams,
    customTimeoutMs?: number
  ): Promise<{ answer: UserAnswer; source: "bubble" | "app" }> {
    // 🔴 Ràng buộc A.5 mục 2: Mỗi job tối đa MỘT ASK mở tại một thời điểm
    if (this.pendingAsks.has(jobId)) {
      const active = this.pendingAsks.get(jobId)!;
      const errorMsg =
        `ERROR [HARNESS_A5_VIOLATION]: Job '${jobId}' đã có 1 ask_user đang mở (Call ID: ${active.toolCallId}) chưa được trả lời. ` +
        `Harness TỪ CHỐI call ASK thứ hai theo Phụ lục A.5 mục 2. ` +
        `Agent phải gộp mọi câu hỏi còn thiếu thành 1 câu duy nhất theo FR-AG-05.`;
      throw new Error(errorMsg);
    }

    const timeoutMs = customTimeoutMs ?? this.defaultTimeoutMs;

    return new Promise((resolve, reject) => {
      const pending: PendingAsk = {
        jobId,
        toolCallId,
        params,
        createdAt: Date.now(),
        timeoutMs,
        resolve,
        reject,
      };

      // Set timeout (A.5 mục 6)
      if (timeoutMs > 0 && timeoutMs < Infinity) {
        pending.timer = setTimeout(() => {
          this.handleTimeout(jobId);
        }, timeoutMs);
      }

      this.pendingAsks.set(jobId, pending);

      // Cập nhật trạng thái job sang waiting_input
      this.ledger.saveJobState(jobId, "waiting_input", toolCallId);
      this.ledger.recordEntry(jobId, "job_state", {
        status: "waiting_input",
        activeAskCallId: toolCallId,
        question: params.question,
      });
    });
  }

  respondAsk(
    jobId: string,
    answer: UserAnswer,
    source: "bubble" | "app" = "bubble"
  ): DecisionRecord {
    const pending = this.pendingAsks.get(jobId);
    if (!pending) {
      throw new Error(`No active ask_user found for job '${jobId}'`);
    }

    if (pending.timer) {
      clearTimeout(pending.timer);
    }

    this.pendingAsks.delete(jobId);

    // Ghi ledger bản ghi loại decision (A.5 mục 4)
    const decisionRecord = this.ledger.recordDecision({
      jobId,
      question: pending.params.question,
      options: pending.params.options,
      answer,
      answerSource: source,
    });

    // Chuyển job về running
    this.ledger.saveJobState(jobId, "running", null);
    this.ledger.recordEntry(jobId, "job_state", {
      status: "running",
      resolvedAskId: pending.toolCallId,
      decisionId: decisionRecord.id,
    });

    // Giải phóng promise để tool trả kết quả cho agent tiếp tục
    pending.resolve({ answer, source });

    return decisionRecord;
  }

  private handleTimeout(jobId: string) {
    const pending = this.pendingAsks.get(jobId);
    if (!pending) return;

    this.pendingAsks.delete(jobId);

    // A.5 mục 6: Timeout waiting_input -> job tạm dừng an toàn, resume được từ app
    this.ledger.saveJobState(jobId, "suspended", pending.toolCallId);
    this.ledger.recordEntry(jobId, "job_state", {
      status: "suspended",
      reason: "waiting_input_timeout",
      activeAskCallId: pending.toolCallId,
    });

    pending.reject(
      new Error(
        `JOB_SUSPENDED_TIMEOUT: waiting_input timed out after ${pending.timeoutMs}ms. Job safely suspended.`
      )
    );
  }

  cancelJob(jobId: string, reason = "User cancelled") {
    const pending = this.pendingAsks.get(jobId);
    if (pending) {
      if (pending.timer) clearTimeout(pending.timer);
      this.pendingAsks.delete(jobId);
      pending.reject(new Error(`JOB_CANCELLED: ${reason}`));
    }
    this.ledger.saveJobState(jobId, "cancelled", null);
    this.ledger.recordEntry(jobId, "job_state", { status: "cancelled", reason });
  }

  cleanup() {
    for (const pending of this.pendingAsks.values()) {
      if (pending.timer) clearTimeout(pending.timer);
    }
    this.pendingAsks.clear();
  }
}

export function createAskUserTool(
  jobId: string,
  manager: AskUserManager,
  timeoutMs?: number
): AgentTool<typeof AskUserSchema> {
  return {
    name: "ask_user",
    label: "Ask User",
    description: "Đặt 1 câu hỏi gộp duy nhất cho người dùng kèm các lựa chọn nhanh khi thiếu thông tin cần thiết",
    parameters: AskUserSchema,
    execute: async (toolCallId: string, params: AskUserParams) => {
      // Chuẩn hoá allow_free_text mặc định là true
      const normalizedParams: AskUserParams = {
        ...params,
        allow_free_text: params.allow_free_text ?? true,
      };

      try {
        const result = await manager.registerAsk(jobId, toolCallId, normalizedParams, timeoutMs);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ answer: result.answer }),
            },
          ],
          details: {
            answer: result.answer,
            source: result.source,
          },
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text" as const,
              text: err.message || "ask_user failed",
            },
          ],
          isError: true,
          details: { error: err.message },
        };
      }
    },
  };
}
