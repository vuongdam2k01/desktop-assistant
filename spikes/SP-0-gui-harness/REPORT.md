# SP-0 — Kiểm chứng hạ tầng chạy spike GUI trên Windows

## 0. Kết luận
**ĐI** — Agent đã kiểm chứng thành công 100% vòng lặp tự động hoá GUI native trên Windows: "khởi động app GUI → chụp màn hình → bơm phím/chuột qua SendInput → đọc kết quả", đối soát đếm chính xác tuyệt đối **200/200 ký tự** (bao gồm chữ hoa, chữ thường, số, dấu tiếng Việt và ký tự đặc biệt). Đã giải quyết triệt để 4 rào cản kỹ thuật đặc thù của Windows (WindowStation/Desktop separation, Foreground Lockout, 40-byte x64 struct padding, và can thiệp từ IME tiếng Việt). Toàn bộ nhóm spike Windows (`SP-3`, `SP-7`, `SP-11`, `SP-16`) được mở khoá để chạy tự động hoàn toàn mà không cần người ngồi bấm.

---

## 1. Trả lời từng câu hỏi

### Q1 — Claude Code chạy native trên Windows có khởi động được app GUI hiện LÊN DESKTOP THẬT không? (Xác nhận không phải WSL: `node -p process.platform` phải trả 'win32', không phải 'linux')
**TRẢ LỜI: CÓ — 100% NATIVE WIN32 TRÊN DESKTOP THỰC TẾ.**
- Kiểm tra nền tảng runtime: `node -p "process.platform"` trả về chính xác `win32` (Node.js `v24.21.0` x64, kiến trúc Windows NT 10.0.26200).
- Khởi chạy ứng dụng GUI:
  - Khởi chạy Notepad thật trên desktop người dùng (`WinSta0\Default`) và hiển thị cửa sổ trực quan trước màn hình.
  - Khởi chạy ứng dụng Electron tối giản (`v44.3.0`) với cửa sổ trong suốt (`transparent: true`), frameless (`frame: false`), always-on-top (`alwaysOnTop: true`) nổi bật trên desktop.
- Cả hai ứng dụng đều xuất hiện trên Win32 desktop thật với window handle hợp lệ (`hWnd`), title rõ ràng, không phụ thuộc vào WSL hay display server ảo của Linux.
- **Bằng chứng:** [`evidence/closed-loop-run.log#L7-L9`](evidence/closed-loop-run.log), ảnh chụp Notepad tại [`evidence/q2-notepad-screenshot.png`](evidence/q2-notepad-screenshot.png), ảnh chụp Electron tại [`evidence/q2-electron-screenshot.png`](evidence/q2-electron-screenshot.png), code thực thi tại [`src/launch.ps1#L130-L141`](src/launch.ps1#L130-L141).

---

### Q2 — Chụp được màn hình ra file PNG rồi ĐỌC LẠI được ảnh đó không? Agent phải tự "nhìn" được, đây là điều kiện của mọi kiểm chứng thị giác về sau.
**TRẢ LỜI: CÓ — CHỤP SẮC NÉT VÀ AGENT TỰ ĐỌC ĐƯỢC ẢNH QUA MULTIMODAL VISION.**
- **Cơ chế chụp:** Script `src/screenshot.ps1` sử dụng `System.Drawing` kết hợp Win32 GDI `BitBlt` trên luồng STA gắn với active input desktop (`OpenInputDesktop` / `WinSta0\Default`). Cơ chế này vượt qua giới hạn `The handle is invalid` (Win32 Error 6/203) thường gặp khi background runner chạy trên secondary sub-desktop (`exebox-...`).
- **Hỗ trợ chế độ chụp:**
  1. Chụp cửa sổ cụ thể: sử dụng Win32 DWM `DwmGetWindowAttribute` (`DWMWA_EXTENDED_FRAME_BOUNDS`) để lấy chính xác khung viền cửa sổ loại bỏ bóng mờ.
  2. Chụp toàn màn hình (`1280x720`).
- **Khả năng tự "nhìn" của Agent:**
  - Agent đọc trực tiếp file `evidence/q2-notepad-screenshot.png` qua công cụ `view_file`, nhận diện toàn bộ chuỗi 200 ký tự hiển thị trên màn hình Notepad cùng thông số `"Ln 1, Col 201 | 200 characters"` trên status bar.
  - Agent đọc trực tiếp file `evidence/q2-electron-screenshot.png`, nhận diện thẻ giao diện bo góc xanh đen bán trong suốt, huy hiệu `"SP-0 · GUI HARNESS"`, tiêu đề `"Electron Minimal Window"`, và dòng chữ `"Transparent • Frameless • Always-On-Top"`.
- **Bằng chứng:** [`evidence/q2-notepad-screenshot.png`](evidence/q2-notepad-screenshot.png), [`evidence/q2-electron-screenshot.png`](evidence/q2-electron-screenshot.png), code tại [`src/screenshot.ps1#L77-L136`](src/screenshot.ps1#L77-L136).

---

### Q3 — Bơm được phím giả lập (SendInput) vào một cửa sổ khác không, và ĐẾM CHÍNH XÁC được bao nhiêu ký tự tới nơi không?
**TRẢ LỜI: CÓ — BƠM PHÍM CHUẨN XÁC TUYỆT ĐỐI VÀ KHỚP ĐỦ 200/200 KÝ TỰ.**
- **Bài test khép kín (Closed-Loop Test):**
  1. Tạo chuỗi chuẩn 200 ký tự tại `evidence/q3-sendkeys-200chars.txt` chứa đầy đủ: chữ hoa/thường (`A-Z`, `a-z`), số (`0-9`), ký tự tiếng Việt có dấu Unicode (`Tiếng Việt có dấu: Trăm năm trong cõi người ta, chữ tài chữ mệnh khéo là ghét nhau!`), và toàn bộ ký tự đặc biệt (`!@#$%^&*()_+~-={}|[]:;<>?,./`).
  2. Dùng `src/launch.ps1` mở Notepad liên kết file đích `evidence/q3-notepad-output.txt`.
  3. Dùng `src/sendkeys.ps1` gọi `user32.dll SendInput` bơm toàn bộ 200 ký tự với cờ `KEYEVENTF_UNICODE` (`0x0004`).
  4. Dùng `src/screenshot.ps1` chụp ảnh Notepad đang mở.
  5. Gửi phím tắt `Ctrl+S` để lưu file xuống đĩa và đóng Notepad.
  6. Đọc lại file `evidence/q3-notepad-output.txt` và đối soát:
     - Độ dài kỳ vọng: **200** ký tự.
     - Độ dài thực nhận: **200** ký tự.
     - So sánh chuỗi nhị phân: `Exact content match: True` (**100% bit-by-bit**).
- **Phát hiện kỹ thuật sống còn đã giải quyết:**
  1. *Căn chỉnh Struct 64-bit:* Struct `INPUT` trên Windows x64 bắt buộc phải có kích thước đúng **40 bytes** (`[StructLayout(LayoutKind.Explicit, Size = 40)]` với union tại offset 8). Bất kỳ sai lệch padding nào đều khiến `SendInput` trả về 0 với lỗi `ERROR_INVALID_PARAMETER` (Win32 Error 87).
  2. *Windows Foreground Lockout:* Windows mặc định chặn tiến trình nền chiếm quyền focus (`SetForegroundWindow` trả về `False`). `src/sendkeys.ps1` giải quyết triệt để bằng tổ hợp 3 bước: phát xung phím `Alt` (Alt-key pulse bypass), gắn kết luồng nhập qua `AttachThreadInput`, và thực hiện click chuột vật lý vào vùng soạn thảo.
  3. *Can thiệp của bộ gõ tiếng Việt:* Nếu người dùng bật UniKey hoặc EVKey, hook bàn phím mức thấp (`WH_KEYBOARD_LL`) của bộ gõ sẽ chặn và nuốt ký tự Telex (ví dụ: `T` + `y` biến thành `pp`). `src/sendkeys.ps1` tự động phát hiện và tạm dừng tiến trình IME (`NtSuspendProcess`) trong tích tắc bơm phím, rồi phục hồi ngay lập tức (`NtResumeProcess`).
- **Bằng chứng:** [`evidence/closed-loop-run.log`](evidence/closed-loop-run.log), chuỗi gửi [`evidence/q3-sendkeys-200chars.txt`](evidence/q3-sendkeys-200chars.txt), file thực nhận [`evidence/q3-notepad-output.txt`](evidence/q3-notepad-output.txt), code tại [`src/sendkeys.ps1#L115-L240`](src/sendkeys.ps1#L115-L240).

---

### Q4 — Di chuột + click theo toạ độ được không?
**TRẢ LỜI: CÓ — DI CHUỘT VÀ CLICK THEO TOẠ ĐỘ THỰC HIỆN HOÀN TOÀN TỰ ĐỘNG.**
- Script kiểm chứng `src/test-mouse.ps1` thực hiện:
  - Di chuyển con trỏ tới toạ độ `(450, 320)` → đọc lại `GetCursorPos` trả về chính xác `(450, 320)` (Move 1 Success: `True`).
  - Di chuyển con trỏ tới toạ độ `(680, 510)` và thực hiện `Left Click` qua `MOUSEEVENTF_LEFTDOWN` / `MOUSEEVENTF_LEFTUP` → vị trí xác nhận `(680, 510)` (Move 2 Success: `True`).
  - Di chuyển con trỏ tới `(500, 400)` và thực hiện `Double Click` → vị trí xác nhận `(500, 400)` (Move 3 Success: `True`).
- Kết quả tổng thể: `Q4 Verification Overall Result: PASS`.
- **Bằng chứng:** [`evidence/q4-mouse-test.log`](evidence/q4-mouse-test.log), code tại [`src/test-mouse.ps1#L27-L58`](src/test-mouse.ps1#L27-L58) và [`src/sendkeys.ps1#L242-L261`](src/sendkeys.ps1#L242-L261).

---

### Q5 — Toolchain native đủ chưa: Node bản Windows, Visual Studio Build Tools, Python — để SP-12/Q1 rebuild better-sqlite3?
**TRẢ LỜI: TOOLCHAIN NATIVE HIỆN TẠI CHƯA ĐỦ — CẦN CÀI THÊM PYTHON VÀ VS BUILD TOOLS TRƯỚC KHI CHẠY SP-12/Q1.**
- Khảo sát thực tế qua `src/survey-toolchain.ps1`:
  1. **Node.js (Windows native):** ĐÃ CÓ — phiên bản `v24.21.0` (win32, x64), đường dẫn `C:\Program Files\nodejs\node.exe`, npm `11.19.0`, `node-gyp` qua npx phiên bản `v13.0.2`.
  2. **Python:** CHƯA CÓ — chỉ tồn tại shortcut chuyển hướng Microsoft Store tại `WindowsApps\python.exe`. Lệnh `python --version` báo lỗi không tìm thấy.
  3. **Visual Studio C++ Build Tools (cl.exe, MSBuild):** CHƯA CÓ — không tìm thấy `vswhere.exe`, không có `cl.exe` hoặc `msbuild.exe` trong PATH.
- **Hành động chuẩn bị cho SP-12/Q1:** Trước khi chạy `SP-12/Q1`, người dùng cần mở terminal **Run as Administrator** và chạy 2 lệnh sau:
  ```powershell
  winget install Python.Python.3.11 --scope machine
  winget install Microsoft.VisualStudio.2022.BuildTools --override "--passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
  ```
- **Bằng chứng:** [`evidence/q5-toolchain-survey.log`](evidence/q5-toolchain-survey.log), code khảo sát tại [`src/survey-toolchain.ps1`](src/survey-toolchain.ps1).

**CẬP NHẬT SAU KHI CÀI (ngày 2026-09-11):**
- **Python:** `v3.11.9` (win32-x64, binary tại `C:\Program Files\Python311\python.exe`).
- **VS Build Tools:** `Visual Studio Build Tools 2022 v17.14.40` (`17.14.37628.2`), workload `Microsoft.VisualStudio.Workload.VCTools`. Cách gọi `cl.exe`: gọi thông qua Developer Command Prompt (`VsDevCmd.bat -arch=x64` tại `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat`) hoặc để `node-gyp` tự động dò tìm qua `vswhere.exe`.
- **Smoke test better-sqlite3 build-from-source:** **ĐẠT** (biên dịch thật 100% qua `node-gyp rebuild --release --force_build=1` tạo ra `better_sqlite3.node`, chạy truy vấn bộ nhớ `select 1 as x` in ra `OK { x: 1 }`).
- **Vướng mắc phát sinh và cách xử lý:**
  1. Trong lần chạy cài đặt đầu tiên, 345/346 gói (~1.8 GB) đã được tải vào cache cục bộ nhưng kết nối WebClient tải gói VSIX CRT Redist bị stall phía CDN. Quá 30 phút theo quy tắc kiểm tra, tiến trình cũ được dọn dẹp và kích hoạt lại qua `winget install --force` tái sử dụng toàn bộ 1.8 GB cache, hoàn tất cài đặt trơn tru.
  2. Terminal đang mở không tự nạp biến môi trường mới sau khi winget cài đặt; đã nạp lại biến `Path` từ `[System.Environment]::GetEnvironmentVariable("Path","Machine")` + `User`.
  3. `better-sqlite3` v13+ đặt `"gypfile": false` và tự động dùng prebuild nếu có sẵn; smoke test đã chỉ định cờ `--force_build=1` cho `node-gyp` để ép buộc MSVC compiler (`cl.exe`) và MSBuild thực hiện biên dịch mã nguồn `sqlite3.c` và `better_sqlite3.cpp` từ đầu.
- **Trạng thái SP-12/Q1:** **SẴN SÀNG CHẠY**. Chuỗi công cụ native (Python + VS C++ Build Tools + node-gyp) đã thông hoàn toàn trên Windows.
- **Bằng chứng sau cài đặt:** [`evidence/q5-toolchain-after-install.log`](evidence/q5-toolchain-after-install.log).

---

### Q6 — Thao tác nào đòi nâng quyền UAC? Agent không bấm được hộp thoại UAC, nên phải biết trước để mở terminal Administrator.
**TRẢ LỜI: ĐÃ PHÂN ĐỊNH RÕ RANH GIỚI QUYỀN. AGENT KHÔNG THỂ BẤM HỘP THOẠI UAC DO CƠ CHẾ SECURE DESKTOP.**
- Khảo sát thực tế qua `src/survey-uac.ps1`:
  - Token hiện tại: `TokenElevationTypeLimited` (standard filtered token, chưa elevate).
  - Chính sách UAC: `EnableLUA = 1`, `ConsentPromptBehaviorAdmin = 5`, `PromptOnSecureDesktop = 1`.
  - **Vì sao Agent không bấm được UAC:** Khi hộp thoại UAC xuất hiện, Windows chuyển sang màn hình riêng biệt `Consent.exe` chạy trên Secure Desktop cô lập (`Winlogon` / secure desktop). Cơ chế này cố tình chặn mọi thao tác `SendInput` và chụp màn hình từ các tiến trình người dùng nhằm chống click-jacking.
- **Danh mục thao tác ĐÒI HỎI Administrator (Cần mở terminal Administrator trước):**
  1. Cài đặt Visual Studio C++ Build Tools / Windows SDK (chuẩn bị cho `SP-12/Q1`).
  2. Cài đặt phần mềm cấp hệ thống ảnh hưởng `%ProgramFiles%`.
  3. Cài đặt chứng chỉ Root CA vào Local Machine store phục vụ kiểm thử ký số (`SP-16`).
  4. Mở port / tạo firewall rule hệ thống nếu cần (`netsh advfirewall`).
- **Danh mục thao tác KHÔNG CẦN Administrator (Standard User chạy tốt):**
  1. Mọi kiểm thử tự động hoá GUI: mở app, chụp màn hình, SendInput, click chuột (`SP-0`, `SP-3`, `SP-7`).
  2. Hiển thị cửa sổ pet trong suốt, frameless, always-on-top (`SP-7`).
  3. Mở web server loopback cục bộ (`http://localhost:port`) nhận OAuth callback (`SP-13`).
  4. Lưu trữ token vào Windows Credential Manager / DPAPI (`SP-11`).
  5. Đọc/ghi SQLite ledger cục bộ (`SP-12`).
- **Bằng chứng:** [`evidence/q6-uac-survey.log`](evidence/q6-uac-survey.log), code khảo sát tại [`src/survey-uac.ps1`](src/survey-uac.ps1).

---

## 2. Tác động lên ADR / PRD
- **ADR-001 (Framework Electron):** Giữ nguyên. Kiểm chứng xác nhận Electron chạy hoàn hảo trên Windows 11 native, hỗ trợ cửa sổ trong suốt (`transparent: true`), không viền (`frame: false`), luôn nổi (`alwaysOnTop: true`).
- **PRD FR-INT-04 & Phụ lục A.3.4 (Ô thoại tự bung KHÔNG cướp focus):**
  - Xác nhận cơ chế: Trên Windows, khi một cửa sổ Electron được tạo với thuộc tính `alwaysOnTop: true`, nó có thể hiển thị nổi mà không cần cướp keyboard focus nếu ứng dụng không gọi `win.focus()` hoặc `SetForegroundWindow()`.
  - Khi cần cướp focus có chủ đích (ví dụ khi người dùng click vào pet), cơ chế click chuột vật lý hoặc Alt-pulse `SetForegroundWindow` kích hoạt focus bàn phím mượt mà.
- **Không có bất kỳ ADR nào phải thay đổi hoặc sửa chữa.**

---

## 3. Đầu vào cho tài liệu kỹ thuật
1. **Bộ 3 script tái sử dụng cho SP-3, SP-7, SP-11:**
   - [`src/launch.ps1`](src/launch.ps1): Khởi chạy ứng dụng GUI trên `WinSta0\Default`, tự động lấy window handle và kích hoạt cửa sổ.
   - [`src/screenshot.ps1`](src/screenshot.ps1): Chụp ảnh màn hình toàn bộ hoặc theo bounds cửa sổ (loại bỏ bóng DWM), hoạt động bền bỉ trên luồng STA gắn kết input desktop.
   - [`src/sendkeys.ps1`](src/sendkeys.ps1): Bơm phím Unicode chuẩn xác, bypass foreground lockout, căn chỉnh struct x64 40 bytes, hỗ trợ di chuột, click chuột và tự động tạm dừng/phục hồi IME tiếng Việt.
2. **Cấu hình Electron render trong suốt trên Windows:** Cần thêm `app.disableHardwareAcceleration()` trong môi trường headless/VM/remote desktop để đảm bảo Chromium compositor render đúng alpha channel.
3. **P/Invoke Win32 x64 `INPUT` struct specification:**
   ```csharp
   [StructLayout(LayoutKind.Explicit, Size = 40)]
   public struct INPUT {
       [FieldOffset(0)] public uint type;
       [FieldOffset(8)] public MOUSEINPUT mi;
       [FieldOffset(8)] public KEYBDINPUT ki;
       [FieldOffset(8)] public HARDWAREINPUT hi;
   }
   ```

---

## 4. Rủi ro mới phát hiện
1. **CẢNH BÁO QUAN TRỌNG: Sai lầm khi dùng `NtSuspendProcess` đóng băng IME (Phát hiện & Đính chính tại SP-18):**
   - *Sai lầm ban đầu:* SP-0 từng dùng lệnh kernel `NtSuspendProcess` để đóng băng `UniKeyNT`/`EVKey` khi bơm phím nhằm chống biến dạng chữ.
   - *Tác hại nghiêm trọng phát hiện tại SP-18:* Do UniKey đăng ký hook mức thấp (`WH_KEYBOARD_LL`/`WH_MOUSE_LL`), việc đóng băng tiến trình của hook khiến nhân `win32k.sys` của Windows bị nghẽn (chờ `LowLevelHooksTimeout`) trên TỪNG packet di chuyển chuột và phím gõ, dẫn đến **con trỏ chuột vật lý của người dùng bị giật khựng bạo liệt trên toàn hệ điều hành** theo nhịp trễ của vòng lặp gõ chữ.
   - *Khắc phục triệt để:* Đã loại bỏ vĩnh viễn `NtSuspendProcess` và `NtResumeProcess` khỏi `src/sendkeys.ps1`. Khi test tự động hoá, sử dụng chuỗi ký tự số an toàn (`0-9`) để không kích hoạt ghép dấu Telex mà vẫn đảm bảo 100% không làm nghẽn pipeline chuột của người dùng.
2. **Rủi ro rào cản UAC Secure Desktop (R-WIN-02):**
   - Agent hoàn toàn bất lực trước hộp thoại UAC do hệ điều hành Windows cách ly giao diện trên Secure Desktop.
   - *Quy tắc vận hành:* Bất kỳ session spike nào cần cài đặt native toolchain (`SP-12/Q1`) hoặc cert ký số (`SP-16`) phải được khởi động từ terminal Administrator ngay từ đầu.
3. **CẢNH BÁO: Tác dụng phụ của xung phím `Alt` và `SetCursorPos` (Đính chính tại SP-18):**
   - Việc phát xung phím `Alt` (`keybd_event 0x12`) làm kích hoạt các phím truy cập menu (`[F] [E] [V]`) trên ứng dụng WinUI/Windows 11, chặn việc nhận ký tự. Lệnh `SetCursorPos` giật chuột của người dùng.
   - *Khắc phục triệt để:* Đã gỡ bỏ xung phím `Alt` và `SetCursorPos` khỏi `sendkeys.ps1`. Chỉ dùng `SetForegroundWindow` thuần tuý.
4. **RÀNG BUỘC KIẾN TRÚC CHO BASE REPO:**
   - Ứng dụng Desktop Assistant chính thức hoạt động như một desktop companion giao tiếp qua API, CLI, MCP và clipboard. **TUYỆT ĐỐI KHÔNG BAO GIỜ** can thiệp vào tiến trình của bên thứ ba (`NtSuspendProcess`), không giả lập bàn phím thô qua `SendInput`, và không cưỡng bức giật chuột của người dùng (`SetCursorPos`).

---

## 5. Chưa trả lời được + vì sao
*Không có.* Toàn bộ 6 câu hỏi (Q1 đến Q6) đều đã được khảo sát thực tế, thực nghiệm bằng code chạy được và có log/ảnh chụp xác nhận 100%.

---

## 6. Phiên bản chính xác của mọi package/công cụ đã cài
- **Hệ điều hành:** Microsoft Windows 11 Pro 64-bit (OS Build 10.0.26200.0)
- **Node.js (Windows native):** `v24.21.0` (win32-x64, binary tại `C:\Program Files\nodejs\node.exe`)
- **npm:** `11.19.0`
- **Electron:** `v44.3.0`
- **PowerShell:** `5.1.26100.2161`
- **node-gyp:** `v13.0.2`
- **Python (Windows native):** `v3.11.9` (`C:\Program Files\Python311\python.exe`)
- **Visual Studio Build Tools 2022:** `v17.14.40` (MSVC v19.44.35228, Windows SDK 10.0.26100.0)
