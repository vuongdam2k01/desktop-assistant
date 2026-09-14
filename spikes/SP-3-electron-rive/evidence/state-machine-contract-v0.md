# Rive State Machine Contract v0 — Pet Desktop Assistant

| Thuộc tính | Giá trị |
| :--- | :--- |
| **Phiên bản** | v0.1 — 12/09/2026 |
| **Đích đến** | Đóng băng giao diện giữa **Animation Designer** (Rive Editor) và **Client Developer** (Electron/TypeScript) |
| **Tương thích Runtime** | `@rive-app/canvas` v2.42.x (WASM runtime) |
| **Tệp asset** | `pet.riv` (đặt tại thư mục assets hoặc nạp động từ runtime path) |

---

## 1. Cấu trúc Artboard & Tọa độ

- **Tên Artboard chính**: `Pet`
- **Kích thước Artboard**: `500 x 500 px` (Vector scale-independent).
- **Gốc tọa độ (Origin)**: `(250, 450)` — Đặt tại đáy/chân nhân vật (bottom-center) để bảo đảm khi pet co giãn, thở, hoặc đổi animation thì chân nhân vật luôn cố định trên mặt bàn/cạnh màn hình, không bị trôi vị trí.
- **Vùng an toàn (Safe Bounding Box)**: Toàn bộ chuyển động của pet (kể cả vung tay, nhảy bật) phải nằm trọn trong khung `500 x 500 px`, không được cắt ngang biên canvas gây rách hình.

---

## 2. State Machine: `PetStateMachine`

### 2.1. Danh sách Inputs

Tất cả logic chuyển trạng thái từ code app sang animation Rive được điều khiển thông qua các Input sau:

| Tên Input | Kiểu dữ liệu | Giá trị mặc định | Mô tả ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `state` | **Number** (Enum) | `0` | Trạng thái nghiệp vụ chính của pet theo FR-PET-02 |
| `is_hovered` | **Boolean** | `false` | Chuột đang rê trên vùng cơ thể pet (chuẩn bị tương tác) |
| `is_dragged` | **Boolean** | `false` | Người dùng đang giữ chuột kéo pet di chuyển trên màn hình |
| `trigger_click` | **Trigger** | — | Kích hoạt phản ứng tương tác tức thì khi người dùng click chuột |
| `trigger_alert` | **Trigger** | — | Báo hiệu có sự kiện khẩn / lỗi nghiêm trọng cần người dùng chú ý |

---

### 2.2. Ánh xạ giá trị `state` (Number) sang 5 trạng thái FR-PET-02

| Giá trị | Mã trạng thái | Tên trạng thái PRD | Hành vi Animation & Vòng lặp (Loop Mode) |
| :---: | :--- | :--- | :--- |
| `0` | `idle` | Nhàn rỗi | Loop liên tục. Nhịp thở chậm nhẹ nhàng, thỉnh thoảng chớp mắt hoặc đảo mắt ngẫu nhiên. |
| `1` | `receiving_order` | Nhận lệnh | One-shot (200-400ms) chuyển sang tư thế tập trung: vểnh tai, mở to mắt, hướng đầu về ô thoại. |
| `2` | `working` | Đang làm việc | Loop liên tục. Gõ bàn phím ảo, lật tài liệu, vầng sáng tư duy hoặc cử chỉ chăm chú giải quyết task. |
| `3` | `waiting_approval` | Chờ phê duyệt | Loop kiên nhẫn. Chỉ tay hoặc ngước nhìn về dialogue card, biểu cảm mong đợi người dùng bấm Approve/Deny. |
| `4` | `has_result` | Có kết quả | One-shot ăn mừng (nhảy cẫng, giơ ngón cái, tung hoa), sau đó chuyển về tư thế hài lòng / sẵn sàng. |

---

## 3. Đặc tả chuyển tiếp (State Transitions & Blending)

1. **Thời gian hòa trộn (Mix / Blend Duration)**:
   - Mọi chuyển tiếp giữa các trạng thái `state` phải cấu hình `Blend Duration = 150ms - 250ms` (không để `0ms` gây giật cục, không để `> 500ms` làm chậm phản hồi UI).
   - Đường cong chuyển động: Cubic Bezier `(0.4, 0.0, 0.2, 1.0)` (Ease-in-out chuẩn).
2. **Ưu tiên ngắt (Interruption Handling)**:
   - State Machine phải cho phép ngắt chuyển tiếp bất kỳ lúc nào: nếu đang từ `receiving_order` (`1`) mà app đổi sang `working` (`2`), Rive phải blend trực tiếp sang `working` mà không cần đợi `receiving_order` chạy hết.
3. **Trạng thái phụ (Any State Layer)**:
   - `is_hovered = true`: Thêm cử chỉ liếc mắt nhìn theo con trỏ hoặc khẽ mỉm cười.
   - `is_dragged = true`: Chân nhân vật co lên, hai tay bám vào không trung (tư thế bị nhấc bổng).
   - `trigger_click`: Giật mình nhẹ hoặc nháy mắt chào một cái rồi quay về trạng thái nền hiện hành.

---

## 4. Quy tắc đóng gói Asset cho Designer

1. **Định dạng xuất**: `.riv` (Rive Runtime Binary).
2. **Tương thích Editor**: Sử dụng phiên bản Rive Editor hiện hành (xuất file tương thích Rive Runtime v2.42+).
3. **Đồ họa**:
   - 100% vector shapes để giữ dung lượng nhẹ (< 150 KB) và khử răng cưa sắc nét ở mọi độ phân giải DPI màn hình.
   - Nếu có dùng ảnh raster (PNG): phải tối ưu nén WebP/PNG, kích thước tối đa 512x512, nhúng trực tiếp vào file `.riv`.
4. **Không hardcode màu nền**: Không vẽ hình chữ nhật nền (background rectangle) bên dưới Artboard. Nền của Artboard phải hoàn toàn trong suốt để Electron hiển thị click-through và chống viền đen.
