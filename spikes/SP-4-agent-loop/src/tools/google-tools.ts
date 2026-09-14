import { Type } from "typebox";
import type { AgentTool } from "@earendil-works/pi-agent-core";

export const FIXTURE_G1 = {
  id: "msg-g1-contract",
  threadId: "thread-g1",
  from: "tuan.pham@company.example",
  to: "user@company.example",
  subject: "Re: Contract HR portal - action items",
  date: "2026-09-10T16:45:00+07:00",
  body: "Chốt sau meeting:\n(1) [user] gửi bản estimate phase 2 trước thứ 4 tuần sau;\n(2) Hùng fix môi trường staging;\n(3) [user] review lại điều khoản SLA với legal, deadline 19/9.\nThanks.",
};

export const FIXTURE_G2 = {
  id: "msg-g2-demo",
  threadId: "thread-g2",
  from: "ngoc.tran@vinmart-demo.example",
  to: "user@company.example",
  subject: "Dời lịch demo",
  date: "2026-09-11T09:10:00+07:00",
  body: "Chào em,\nbên chị bận họp quý nên xin dời buổi demo app sang thứ 5 24/9 nhé, giờ giữ nguyên 10h.\nCảm ơn em.",
};

export const FIXTURE_D1 = {
  id: "file-d1-checkout-v3",
  name: "Spec_Vinmart_Checkout_v3",
  mimeType: "application/vnd.google-apps.document",
  content: `# Spec Vinmart Checkout v3

## 1. Overview
Tài liệu quy định kiến trúc và luồng thanh toán tổng thể cho ứng dụng Vinmart Mobile. Phạm vi áp dụng cho sprint 15 và phase 2.

## 2. Cart
Quy định logic giỏ hàng, cập nhật số lượng mặt hàng trong giỏ, voucher giảm giá và tính toán tạm tính (subtotal).

## 3. Payment
Tích hợp các cổng thanh toán nội địa (VNPAY, MoMo, thẻ tín dụng). Xử lý idempotency key và callback webhook đối soát.

## 4. Order confirmation
Màn hình xác nhận hoàn tất đơn hàng, lưu thông tin hóa đơn điện tử và gửi thông báo đẩy tới người dùng.`,
};

function toolSuccess(data: any) {
  return {
    content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
    details: data,
  };
}

export function createGoogleTools(recordRead?: (toolName: string, params: any) => void): AgentTool[] {
  const gmailSearchTool: AgentTool = {
    name: "gmail_search",
    label: "Search Gmail Messages",
    description: "Search for emails in Gmail using search terms (sender, subject, or keywords). Returns matching message summaries.",
    parameters: Type.Object({
      query: Type.String({ description: "Query string to search emails, e.g. 'contract', 'demo', 'from:tuan.pham'" }),
    }),
    execute: async (_toolCallId, params: any) => {
      recordRead?.("gmail_search", params);
      const q = (params.query || "").toLowerCase();
      const results: any[] = [];

      if (q.includes("contract") || q.includes("tuan") || q.includes("hr")) {
        results.push({
          id: FIXTURE_G1.id,
          from: FIXTURE_G1.from,
          subject: FIXTURE_G1.subject,
          date: FIXTURE_G1.date,
          snippet: FIXTURE_G1.body.substring(0, 100),
        });
      }
      if (q.includes("demo") || q.includes("vinmart") || q.includes("dời")) {
        results.push({
          id: FIXTURE_G2.id,
          from: FIXTURE_G2.from,
          subject: FIXTURE_G2.subject,
          date: FIXTURE_G2.date,
          snippet: FIXTURE_G2.body.substring(0, 100),
        });
      }

      return toolSuccess({
        count: results.length,
        messages: results,
      });
    },
  };

  const gmailGetMessageTool: AgentTool = {
    name: "gmail_get_message",
    label: "Get Gmail Message Details",
    description: "Fetch the full body and headers of a specific email message by message_id.",
    parameters: Type.Object({
      message_id: Type.String({ description: "ID of the email message" }),
    }),
    execute: async (_toolCallId, params: any) => {
      recordRead?.("gmail_get_message", params);
      if (params.message_id === FIXTURE_G1.id || params.message_id.includes("g1") || params.message_id.includes("contract")) {
        return toolSuccess(FIXTURE_G1);
      }
      if (params.message_id === FIXTURE_G2.id || params.message_id.includes("g2") || params.message_id.includes("demo")) {
        return toolSuccess(FIXTURE_G2);
      }
      return toolSuccess({ error: `Message ${params.message_id} not found` });
    },
  };

  const driveSearchTool: AgentTool = {
    name: "drive_search",
    label: "Search Google Drive Files",
    description: "Search Google Drive for files matching a name query or keywords.",
    parameters: Type.Object({
      query: Type.String({ description: "Name or keyword of the file in Google Drive" }),
    }),
    execute: async (_toolCallId, params: any) => {
      recordRead?.("drive_search", params);
      const q = (params.query || "").toLowerCase();
      const results: any[] = [];

      if (q.includes("checkout") || q.includes("spec") || q.includes("vinmart") || q.includes("v3")) {
        results.push({
          id: FIXTURE_D1.id,
          name: FIXTURE_D1.name,
          mimeType: FIXTURE_D1.mimeType,
        });
      }

      return toolSuccess({
        count: results.length,
        files: results,
      });
    },
  };

  const driveReadFileTool: AgentTool = {
    name: "drive_read_file",
    label: "Read Google Drive File Content",
    description: "Read the full document content and sections of a Google Drive document by file_id.",
    parameters: Type.Object({
      file_id: Type.String({ description: "ID of the Drive file to read" }),
    }),
    execute: async (_toolCallId, params: any) => {
      recordRead?.("drive_read_file", params);
      if (params.file_id === FIXTURE_D1.id || params.file_id.includes("checkout") || params.file_id.includes("d1")) {
        return toolSuccess(FIXTURE_D1);
      }
      return toolSuccess({ error: `File ${params.file_id} not found` });
    },
  };

  return [gmailSearchTool, gmailGetMessageTool, driveSearchTool, driveReadFileTool];
}
