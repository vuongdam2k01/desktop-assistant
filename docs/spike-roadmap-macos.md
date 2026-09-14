# LỘ TRÌNH SPIKE macOS — Desktop Assistant

| | |
| --- | --- |
| Phiên bản | 1.0 — 13/09/2026 |
| Quan hệ | Phần bổ sung của `docs/spike-roadmap.md`. Mục 3 (Quy tắc chung) của file gốc vẫn áp dụng nguyên văn; file này chỉ thêm phần riêng của macOS. |
| Bối cảnh | Nhánh macOS được mở lại sau quyết định HOÃN ngày 11/09/2026 (`docs/spike-inputs.md` §5). Điều kiện thoát đã ghi trong chính quyết định đó: mở lại **trước khi bắt đầu M3**. |
| Máy | **Mac mini** có màn hình, chạy trực tiếp tại máy. Người dùng ngồi trước máy nên bấm được hộp thoại quyền khi cần. |
| Agent runtime | **Antigravity** chạy qua giao diện, ngay trên Mac mini, trong phiên đăng nhập đồ hoạ — khác Windows (Claude Code) và Linux. Runtime khác nghĩa là toàn bộ giả định về hạ tầng tự động hoá phải kiểm chứng lại từ đầu ở `SP-0/mac`. Xem mục 3.3. |
| Tổng | 8 spike · 7 spike đối chiếu với bản Windows đã xong · 1 spike chỉ có trên macOS (`SP-22`) |

**Cách dùng file này:** mở mục 5, copy nguyên khối prompt của spike cần chạy, dán vào session Antigravity chạy trên Mac mini. Mỗi session chạy ĐÚNG MỘT spike.

---

## 1. VÌ SAO MỞ LẠI NHÁNH NÀY

`docs/spike-inputs.md` §5 đã liệt kê sẵn phần bỏ ngỏ khi hoãn macOS, kèm mức nghiêm trọng. Toàn bộ nhánh Windows và Linux nay đã xong, nên những ô bỏ ngỏ đó là phần kiểm chứng còn thiếu duy nhất của M0:

| Phần bỏ ngỏ | Spike macOS trả lời | Mức nghiêm trọng đã ghi |
| --- | --- | --- |
| Không cướp focus, click-through, always-on-top trên macOS | `SP-7/mac` | 🔴 Cao — đường găng, R-3 của PRD nêu đích danh macOS là chỗ khó nhất |
| fps, anti-alias viền, tài nguyên idle | `SP-3/mac` | 🟠 Trung |
| Keychain (không suy ra được từ Credential Manager) | `SP-11/mac` | 🟠 Trung |
| ABI arm64/darwin cho `better-sqlite3` | `SP-12/mac` | 🟠 Trung |
| Apple notarization — không dry-run được trên Windows | `SP-16/mac` | 🟡 Thấp ở giai đoạn trước, nay đã tới lúc |
| Hạ tầng tự động hoá theo từng máy | `SP-0/mac` | 🟢 Vốn là kiểm chứng riêng từng máy |
| Pet di chuyển / nhận biết màn hình trên macOS (`SP-18` §5 hoãn theo §3.6) | `SP-18/mac` | 🔴 Cao — quyết định kiến trúc M3 |
| Quyền TCC và onboarding — **không có đối ứng trên Windows** | `SP-22` | 🔴 Cao — quyết định luồng onboarding và phạm vi MVP |

**`SP-13` không lặp lại.** Kết luận BYO OAuth trên Windows là ĐI, và cơ chế của nó — listener loopback `127.0.0.1` cộng trình duyệt hệ thống — không phụ thuộc OS. Nếu `SP-0/mac` phát hiện macOS chặn việc mở trình duyệt mặc định từ tiến trình agent thì mới mở lại câu này.

**Ghi âm hệ thống (Chức năng cố định, Phase 3) không nằm trong loạt này.** Trên macOS việc đó cần ScreenCaptureKit hoặc audio driver riêng và chưa có spike đối ứng trên Windows; đưa vào đây là mở rộng phạm vi M0 chứ không phải lấp khoảng trống macOS.

---

## 2. THỨ TỰ CHẠY

Tài nguyên tranh chấp trên macOS là **desktop, focus, và trạng thái quyền TCC**. Cái thứ ba là điểm khác Windows: một lần `tccutil reset` thu hồi quyền của chính tiến trình agent và làm hỏng hạ tầng đo.

```
Đợt A   SP-0/mac    hạ tầng + quyền      MỞ KHOÁ MỌI THỨ — chạy đầu tiên
Đợt B   SP-7/mac 🔴 cửa sổ pet           MỘT MÌNH, desktop yên tĩnh, không cài gì
Đợt C   SP-11/mac ∥ SP-12/mac            cặp song song duy nhất an toàn
Đợt D   SP-3/mac    Electron + Rive      một mình, CPU phải yên
Đợt E   SP-18/mac 🔴 pet sống            nhiều câu hỏi nhất; phần soak chạy nền
Đợt F   SP-16/mac   ký số + notarize     cần quyết định về tài khoản Apple Developer
Đợt G   SP-22       quyền TCC & onboard  CUỐI CÙNG — phá trạng thái quyền của máy
```

| Spike | Chiếm desktop | Tải CPU | Cần người bấm |
| --- | --- | --- | --- |
| `SP-0/mac` | có | nhẹ | **có** — mọi hộp thoại quyền lần đầu |
| `SP-7/mac` 🔴 | **độc quyền** — đo chính việc cướp focus | nhẹ | không |
| `SP-11/mac` | gần như không | nhẹ | **có thể** — hộp thoại Keychain |
| `SP-12/mac` | **không** — thuần CLI | **cao** | có thể — `xcode-select --install` |
| `SP-3/mac` | có — always-on-top, chụp màn hình | **cao** — cố ý tạo tải 70% | không |
| `SP-18/mac` 🔴 | **độc quyền** khi đo; phần soak chạy nền không cần ngồi canh | vừa đến cao | không |
| `SP-16/mac` | có ở bước dry-run update | vừa | có — Gatekeeper, cài đặt |
| `SP-22` | có | nhẹ | **có, nhiều lần** — cấp rồi thu hồi quyền |

**Vì sao `SP-7/mac` chạy một mình:** cùng lý do đã ghi ở `docs/spike-roadmap.md` §4.1 cho bản Windows — phép đo là đếm 200 ký tự có tới đủ không trong lúc card tự bung, một cửa sổ lạ bật lên giữa chừng đủ làm sai kết luận và kéo theo một workstream native vào MVP mà lẽ ra không cần.

**Vì sao `SP-22` chạy cuối:** nó cố ý thu hồi và cấp lại quyền để dựng lại ca "người dùng lần đầu". Quyền Screen Recording và Accessibility mà `SP-0/mac` đã cấp cho tiến trình agent nằm trong số bị thu hồi. Chạy `SP-22` giữa chừng là tự phá hạ tầng đo của các spike còn lại.

### Phụ thuộc cứng

| Spike | Phải xong trước | Vì sao |
| --- | --- | --- |
| Mọi spike GUI | `SP-0/mac` | Cần script chụp màn hình + bơm phím, và cần biết quyền nào phải cấp tay |
| `SP-18/mac` | `SP-7/mac`, `SP-3/mac` | Cần kết luận về native module và về state machine Rive |
| `SP-22` | tất cả spike khác | Phá trạng thái quyền của máy |
| `SP-16/mac` | — | Độc lập; chỉ phụ thuộc quyết định có tài khoản Apple Developer hay không |

---

## 3. QUY TẮC RIÊNG CHO macOS

> Mục 3 của `docs/spike-roadmap.md` vẫn áp dụng đầy đủ — đặc biệt 3.3 (tuyệt đối không) và 3.4 (khung REPORT.md bắt buộc). Phần dưới là bổ sung, không thay thế.

### 3.1. Nơi ghi kết quả

Kết quả macOS nằm trong **thư mục con `macos/` của chính spike tương ứng**, không tạo thư mục spike mới:

```
spikes/SP-7-pet-window-os/
├── REPORT.md          # bản Windows — KHÔNG ĐỤNG VÀO
├── README.md
├── src/
├── evidence/
└── macos/             # ← session macOS ghi ở đây
    ├── REPORT.md      # cùng khung §3.4
    ├── README.md
    ├── src/
    └── evidence/
```

Riêng `SP-22` không có bản Windows nên đứng thành thư mục riêng: `spikes/SP-22-macos-permissions/`.

Lý do của cách sắp xếp này: báo cáo Windows là bằng chứng đã được các spec trích dẫn, sửa vào đó là làm hỏng đường trích dẫn đang có; còn đặt cạnh nhau theo mối bận tâm thì người đọc spec thấy ngay cả hai nửa của cùng một câu hỏi. Bộ kiểm tra `spec-check.mjs evidence` nhận `spikes/**/REPORT.md` nên đường dẫn mới vẫn trích dẫn được.

### 3.2. Runtime agent là Antigravity, không phải Claude Code

`SP-0` trên Windows kiểm chứng hạ tầng cho Claude Code chạy trực tiếp trên desktop. Không suy ra được gì cho Antigravity. `SP-0/mac` phải trả lời lại từ đầu: mở được app GUI lên màn hình thật không, đọc lại được ảnh PNG vừa chụp không, bơm được sự kiện chuột/phím không. Nếu một trong ba câu đó fail thì mọi spike GUI còn lại chuyển sang chế độ có người ngồi trước máy, và phải ghi rõ điều đó ở mục 0 của `SP-0/mac`.

### 3.3. Điều kiện môi trường phải giữ trong suốt loạt spike

Agent chạy trong chính phiên đăng nhập đồ hoạ nên việc mở cửa sổ, chụp màn hình và bơm sự kiện đều nằm cùng một phiên — đây là điều kiện thuận lợi mà bản Windows cũng có. Nhưng máy này là Mac mini để bàn chạy dài ngày, nên có vài thứ phải chốt trước và giữ nguyên, nếu không các phép đo sẽ sai một cách âm thầm:

- **Màn hình không được tự khoá và máy không được ngủ** trong lúc đo. Màn hình khoá thì không chụp được nội dung và không bơm được sự kiện; máy ngủ giữa phép đo dài của `SP-18/mac` là mất trắng phép đo. Tắt tự khoá và tự ngủ, hoặc chống ngủ bằng `caffeinate` trong suốt phiên chạy.
- **Ghi lại cấu hình màn hình đang gắn**: độ phân giải, hệ số scale, tần số quét, số màn hình. `SP-3/mac` và `SP-18/mac` kết luận theo những con số này, nên report nào cũng phải có chúng ở mục 6.
- **Không đổi cấu hình màn hình giữa loạt** trừ khi chính câu hỏi yêu cầu, vì đổi giữa chừng làm hai report không so được với nhau.
- **Quyền TCC cấp trước** — xem mục 3.4.

`SP-0/mac` phải kiểm chứng và ghi lại đúng cách đã làm, vì mọi session sau dựng lại y như vậy.

### 3.4. Quyền TCC phải cấp trước, và cấp cho đúng tiến trình

macOS gắn quyền vào **binary cha đang chạy lệnh**, không phải vào script. Agent gọi `screencapture` từ terminal tích hợp của Antigravity thì thứ cần quyền Screen Recording là binary Antigravity (hoặc terminal đang chạy nó), chứ không phải `screencapture`. Chuỗi cha thực tế phải đo, không đoán.

Hộp thoại xin quyền hiện ra trên màn hình và người dùng bấm được — thuận lợi hơn ca "UAC chạy trên Secure Desktop" của `SP-0` Windows. Nhưng agent vẫn KHÔNG tự bật được công tắc trong System Settings, và một số quyền chỉ có hiệu lực sau khi khởi động lại app. Nên cách làm là: cấp trước những quyền đã biết sẽ cần, và khi gặp hộp thoại mới thì dừng lại nhờ người bấm rồi chạy lại, chứ không tìm đường lách.

Mọi REPORT phải ghi rõ: quyền nào đã cấp, cấp cho tiến trình nào, cấp bằng đường nào, và câu trả lời sẽ đổi thế nào nếu người dùng cuối từ chối quyền đó.

### 3.5. Ghi kiến trúc máy trong mọi report

Mỗi REPORT phải mở đầu mục 6 bằng: `sw_vers` (phiên bản macOS), `uname -m` (arm64 hay x86_64), chip, và xác nhận Node/Electron **không chạy dưới Rosetta** (`sysctl sysctl.proc_translated` trả 0). Kết luận về `better-sqlite3`, universal binary và hiệu năng render đều vô nghĩa nếu thiếu thông tin này.

### 3.6. Bắt buộc đối chiếu với kết luận Windows

Đây là điểm khác biệt lớn nhất so với loạt spike trước: các spike macOS **không phải khám phá từ đầu**, chúng đo lại cùng một câu hỏi trên một OS khác. Nên mỗi câu trả lời phải kết thúc bằng một trong ba nhãn, kèm số liệu:

- **GIỐNG Windows** — cùng kết luận, nêu số liệu hai bên.
- **KHÁC Windows** — nêu rõ khác chỗ nào và hệ quả lên ADR/spec nào.
- **KHÔNG ÁP DỤNG** — cơ chế Windows không tồn tại trên macOS, nêu cơ chế thay thế đã thử.

Mỗi REPORT macOS phải có thêm một mục `## 7. Bảng đối chiếu Windows ↔ macOS` ngoài khung §3.4, liệt kê từng câu hỏi kèm nhãn. Đây là thứ các spec sẽ trích dẫn khi gỡ nhãn "CHƯA KIỂM CHỨNG".

### 3.7. Không kết luận từ tài liệu Apple

Giữ nguyên quy tắc §3.6 của roadmap gốc. Tài liệu Apple, release note của Electron, câu trả lời trên diễn đàn đều không phải bằng chứng. Chỉ tra được mà chưa chạy thử → ghi **CHƯA KIỂM CHỨNG** kèm lý do không chạy được.

### 3.8. Khi một spike xong

1. Cập nhật bảng mục 4 của file này.
2. Tìm mọi chỗ trong `docs/spec/` và trong REPORT Windows tương ứng còn ghi "CHƯA KIỂM CHỨNG — macOS hoãn" hoặc "UNVERIFIED on macOS" cho câu hỏi vừa trả lời, và thay bằng trích dẫn tới report macOS mới. Ví dụ điểm cần sửa đã biết: `docs/spec/capabilities/platform/spec.md` dòng 20.
3. Chạy `node plugins/specdocs/scripts/spec-check.mjs evidence`. Mỗi REPORT mới thêm 4 mục bắt buộc phải được trích dẫn (mục 2, 3, 4, 5 theo cấu hình `evidence_sections`); chưa spec nào trích dẫn thì bộ kiểm tra báo `EVID_UNCITED` mức medium và cổng "100% CLEAN" đóng. Nghĩa là: viết report xong chưa phải là xong, phải đưa kết luận vào spec mới xong.
4. Nếu kết luận lật một ADR → dừng, trình product owner, đúng như quy tắc GATE của roadmap gốc.

### 3.9. Giới hạn phần cứng của Mac mini — ghi thiếu, không đoán bù

Mac mini là máy để bàn: màn hình là màn rời, không có màn hình tích hợp và không có pin. Một số câu hỏi trong loạt này hỏi về phần cứng mà máy này không có, và câu trả lời cho chúng **không suy ra được** từ máy khác hay từ tài liệu:

| Thứ không có sẵn | Câu hỏi bị ảnh hưởng | Cách xử lý |
| --- | --- | --- |
| Màn hình tích hợp Retina và notch | `SP-7/mac` Q5, `SP-18/mac` Q4 | Vùng notch ghi **CHƯA KIỂM CHỨNG — cần MacBook đời có notch**. Phần menu bar và Dock vẫn đo được bình thường trên màn hình đang gắn. |
| Màn hình ProMotion 120Hz | `SP-3/mac` Q1, `SP-18/mac` Q1 | Đo ở tần số quét thực tế của màn hình đang gắn và GHI RÕ tần số đó. Phần 120Hz ghi CHƯA KIỂM CHỨNG. |
| Pin | `SP-3/mac` Q4, `SP-18/mac` Q3 | Vẫn đo công suất tiêu thụ bằng công cụ hệ thống — con số đó có giá trị. Nhưng mọi kết luận dạng "hao pin bao nhiêu phần trăm một giờ" ghi CHƯA KIỂM CHỨNG — cần máy laptop. |
| Hai màn hình khác hệ số scale | `SP-7/mac` Q4, `SP-18/mac` Q2 | Nếu gắn được hai màn hình khác độ phân giải thì đo thật. Nếu không, ghi CHƯA KIỂM CHỨNG kèm lý do, giống cách bản Windows xử lý ca E2 khi chỉ có một màn hình. |
| Sidecar / AirPlay display | `SP-18/mac` Q29 | Thử nếu có iPad hoặc Apple TV trong tầm tay; không có thì ghi CHƯA KIỂM CHỨNG. |

Quy tắc chung, giống §3.6 của roadmap gốc: thiếu phần cứng thì ghi **CHƯA KIỂM CHỨNG — thiếu phần cứng, cần máy có `<X>`**, tuyệt đối không ghi "không hỗ trợ" và không suy đoán kết quả. Mỗi REPORT gom các mục này vào mục 5 để cuối loạt có một danh sách chính xác những gì cần một máy macOS khác để chốt.

---

## 4. BẢNG THEO DÕI macOS

Toàn bộ loạt đã chạy xong ngày 13/09/2026 trên Mac mini (Apple Silicon M1, macOS 26.5.2, APFS bật FileVault).

| Spike | Kết luận | REPORT |
| --- | --- | --- |
| `SP-0/mac` hạ tầng GUI + quyền | ✅ **ĐI** — vòng lặp chạy app → chụp → bơm phím → đọc kết quả tự động hoàn toàn, bài test khép kín khớp 200/200 ký tự | `spikes/SP-0-gui-harness/macos/REPORT.md` |
| `SP-7/mac` cửa sổ pet 🔴 | ✅ **ĐI CÓ ĐIỀU KIỆN** — Electron thuần đạt 10/10 ở FR-INT-04, không cần native cho câu này; phần native macOS còn lại là AppKit và **hoàn toàn riêng** so với Win32 | `spikes/SP-7-pet-window-os/macos/REPORT.md` |
| `SP-11/mac` Keychain | ✅ **ĐI CÓ ĐIỀU KIỆN** — safeStorage dùng Keychain, không giới hạn kích thước; **bắt buộc** ký bằng Apple Developer ID, nếu không mỗi lần auto-update sẽ đòi mật khẩu máy và từ chối là hỏng toàn bộ credential | `spikes/SP-11-secure-storage/macos/REPORT.md` |
| `SP-12/mac` native rebuild + độ bền ghi | ✅ **ĐI CÓ ĐIỀU KIỆN** — 200/200 lượt tiêm crash không mất bản ghi, nhưng **bắt buộc** bật `fullfsync`; giá phải trả là 28.000 → 241 writes/giây | `spikes/SP-12-sqlite-ledger/macos/REPORT.md` |
| `SP-3/mac` Electron + Rive | ✅ **ĐI** — 60 fps ổn định dưới tải CPU ~70–80%, đổi trạng thái trung bình 11,06 ms, viền trong suốt sạch, render qua Metal | `spikes/SP-3-electron-rive/macos/REPORT.md` |
| `SP-18/mac` pet sống 🔴 | ✅ **ĐI CÓ ĐIỀU KIỆN** — chọn Kiến trúc A, **giống Windows**; 10/10 ở FR-INT-04 lúc pet đang di chuyển; đề xuất không xin quyền Screen Recording; FR-PET-03 cần native AppKit | `spikes/SP-18-pet-liveness/macos/REPORT.md` |
| `SP-16/mac` ký số + notarize | ✅ **ĐI CÓ ĐIỀU KIỆN** — dry-run auto-update chạy trọn, việc mua **không chặn M0** (giống Windows); nhưng Apple Developer Program phải có tối thiểu 2 tuần trước Closed Beta | `spikes/SP-16-signing-update/macos/REPORT.md` |
| `SP-22` quyền TCC & onboarding | ✅ **ĐI** — bản MVP chạy trọn với **ZERO quyền TCC**, onboarding macOS không có bước cấp quyền nào | `spikes/SP-22-macos-permissions/REPORT.md` |

### Bốn phát hiện đã đổi đặc tả

Phần lớn kết quả là xác nhận macOS hành xử như Windows. Bốn phát hiện thì không, và chúng đã được đưa vào
`docs/spec/` qua change `req-023-macos-platform-baseline`:

1. **Độ bền ghi.** `fsync()` trên macOS không đẩy dữ liệu qua khỏi cache của ổ đĩa. Nguyên tắc III chỉ đứng
   vững khi bật flush vật lý, và điều đó tốn hai bậc độ lớn về throughput.
2. **Chữ ký là ràng buộc đúng đắn, không phải thủ tục phát hành.** Đổi chữ ký giữa hai bản là mất sạch
   credential đã lưu và quyền đã cấp của người dùng, không có đường khôi phục.
3. **Native là hai khối việc, không phải một.** macOS không cần native cho việc chống cướp focus, nhưng phần
   native còn lại là AppKit và không dùng chung dòng mã nào với Win32.
4. **MVP không cần quyền hệ thống nào.** Đã đo trên trạng thái quyền sạch. Sàn này chỉ giữ được nếu nó được
   viết thành yêu cầu trước khi tính năng đầu tiên cần quyền xuất hiện ở M3.

### Còn thiếu phần cứng

Theo mục 3.9, các câu sau ghi CHƯA KIỂM CHỨNG vì Mac mini không có phần cứng tương ứng, và cần một máy khác để
chốt: màn ProMotion 120 Hz, hai màn hình khác hệ số scale, mức hao pin, vùng notch, Sidecar/AirPlay, và toàn bộ
kết luận trên máy Intel.

## 5. PROMPT TỪNG SPIKE

Xếp theo thứ tự chạy. Copy nguyên khối trong ô code, dán vào session Antigravity trên Mac mini.

Mọi prompt từ `SP-7/mac` trở đi đều giả định `SP-0/mac` đã xong và đã để lại `spikes/SP-0-gui-harness/macos/README.md` mục "Chuẩn bị máy" cùng ba script tái dùng. Trước mỗi session, kiểm tra lại máy đúng theo mục đó: màn hình không tự khoá, máy không tự ngủ, quyền đã cấp cho đúng tiến trình.

---

### SP-0/mac · Hạ tầng GUI + quyền trên macOS — đợt A · không phụ thuộc

Mở khoá toàn bộ nhánh macOS. Chạy đầu tiên, trước mọi thứ khác.

```text
Đọc docs/spike-roadmap.md mục 3 (Quy tắc chung) và docs/spike-roadmap-macos.md
mục 3 (Quy tắc riêng macOS) rồi thực hiện SP-0/mac.

SPIKE SP-0/mac — Hạ tầng chạy spike GUI trên macOS
Thư mục: spikes/SP-0-gui-harness/macos/
Đọc thêm: FR-INT-04, Phụ lục A.3.4 của docs/raw-idea/prd-mvp.md
Đối chiếu: spikes/SP-0-gui-harness/REPORT.md (bản Windows, Claude Code)

MỤC ĐÍCH: chứng minh Antigravity chạy ngay trên Mac mini tự động hoá được vòng
lặp "chạy app GUI → nhìn → bơm phím → đọc kết quả". Bản Windows đã chứng minh
vòng này cho Claude Code; runtime ở đây KHÁC nên không suy ra được gì. Nếu vòng
này chạy, SP-3/mac, SP-7/mac, SP-11/mac, SP-16/mac, SP-18/mac tự động hoá được.

Q1. Agent có khởi động được app GUI hiện LÊN MÀN HÌNH THẬT không? Xác nhận môi
    trường: `uname -s` trả Darwin, `uname -m` (arm64 hay x86_64), `sw_vers`, và
    `sysctl sysctl.proc_translated` trả 0 (không chạy dưới Rosetta). Xác nhận
    app thật sự hiện chứ không chỉ tồn tại trong danh sách tiến trình — chứng
    minh bằng ảnh chụp.
Q2. Chụp được màn hình ra PNG (`screencapture`, cả toàn màn hình lẫn theo
    window id) rồi agent ĐỌC LẠI được ảnh đó không? Agent phải tự "nhìn" được —
    đây là điều kiện của mọi kiểm chứng thị giác về sau. Ghi rõ quyền Screen
    Recording được cấp cho tiến trình NÀO và cấp bằng cách nào.
Q3. 🔴 Bơm được phím giả lập vào một cửa sổ khác không, và ĐẾM CHÍNH XÁC được
    bao nhiêu ký tự tới nơi không? So sánh ít nhất hai đường: sự kiện CGEvent ở
    tầng thấp, và `osascript` keystroke. Ghi rõ đường nào giữ đủ Unicode, và
    bộ gõ tiếng Việt đang bật có can thiệp không (bản Windows đã vấp đúng chỗ
    này với IME).
Q4. Di chuột + click theo toạ độ được không? Hệ toạ độ của ảnh chụp và của sự
    kiện chuột có cùng gốc không, và hệ số scale của màn hình quy đổi thế nào?
    Sai hệ số là click trượt gấp đôi khoảng cách — phải đo, không đoán.
Q5. Cấu hình màn hình của máy này là gì: độ phân giải, hệ số scale, tần số quét,
    số màn hình đang gắn? Ghi thành một mục riêng vì SP-3/mac và SP-18/mac kết
    luận theo những con số này.
Q6. Màn hình tự khoá và máy tự ngủ ảnh hưởng thế nào tới vòng lặp đo? Ghi lại
    cách đã tắt hai thứ đó và cách chống ngủ khi chạy dài (`caffeinate`). Kèm
    theo: chạy được một tiến trình đo nền SỐNG SÓT SAU KHI ĐÓNG SESSION AGENT
    không, và nó ghi số đo ra file theo chu kỳ được không? Phép đo dài của
    SP-18/mac phụ thuộc trực tiếp vào câu này.
Q7. Toolchain native đủ chưa cho SP-12/mac: Node bản nào và kiến trúc nào,
    Xcode Command Line Tools đã có chưa, Python nào? `xcode-select --install`
    bật hộp thoại GUI — agent tự bấm được không hay cần người?
Q8. 🔴 Thao tác nào đòi người bấm mà agent không tự làm được? Liệt kê CHÍNH XÁC
    từng hộp thoại quyền gặp phải (Screen Recording, Accessibility, Input
    Monitoring, Automation/Apple Events, Notifications, Files & Folders):
    - cấp cho tiến trình NÀO thì vòng lặp chạy? Ghi lại chuỗi cha thực tế của
      lệnh (app Antigravity → terminal tích hợp → lệnh con).
    - hộp thoại tự hiện ra hay im lặng từ chối? Nếu im lặng thì agent phát hiện
      thiếu quyền bằng dấu hiệu gì?
    - cấp xong có phải khởi động lại app mới có hiệu lực không?
    - quyền có sống qua restart máy không? `tccutil` làm được gì?
    Đây là bản sao macOS của phát hiện "UAC chạy trên Secure Desktop" ở SP-0
    Windows, và là đầu vào trực tiếp của SP-22.
Q9. App Electron build tại chỗ, chưa ký, có bị Gatekeeper chặn khi mở không?
    Cần gỡ thuộc tính quarantine hay ký ad-hoc? Ghi lại lệnh đã dùng.

BÀI TEST KHÉP KÍN (bắt buộc)
Mở TextEdit → bơm chuỗi 200 ký tự đã biết, có dấu tiếng Việt và ký tự đặc biệt
→ chụp màn hình → đọc lại ảnh → lưu file và đếm ký tự thực nhận. Phải khớp
200/200. Dùng đúng chuỗi mẫu của bản Windows tại
spikes/SP-0-gui-harness/evidence/q3-sendkeys-200chars.txt để hai bên so được.
Bài test phải chạy trọn vẹn không có người can thiệp giữa chừng.

ĐẦU RA NGOÀI REPORT.md
- macos/src/ chứa 3 script tái dùng được: screenshot, sendkeys, launch.
  SP-3/mac, SP-7/mac, SP-11/mac, SP-18/mac sẽ dùng lại y nguyên — viết cho sạch,
  đây là ngoại lệ duy nhất của quy tắc "code spike vứt đi".
- macos/README.md phải mở đầu bằng mục "Chuẩn bị máy": đúng những gì phải làm
  tay trên Mac mini trước khi mở session (tắt khoá màn hình và tự ngủ, cấu hình
  màn hình đang gắn, quyền đã cấp cho tiến trình nào). Mọi prompt sau tham
  chiếu về đây.
- macos/evidence/permission-prompts/ — ảnh chụp hoặc log của từng hộp thoại
  quyền gặp phải.

TIÊU CHÍ ĐẠT: Q1–Q4 đều CÓ kèm bằng chứng, bài test khép kín khớp 200/200.
Nếu Q2 hoặc Q3 fail → mục 0 ghi KHÔNG ĐI, nêu rõ chặn ở tầng nào (quyền, hay
cơ chế bơm sự kiện), và báo rõ các spike GUI macOS phải chuyển sang chế độ có
người ngồi bấm.
```

---

### SP-7/mac · Cửa sổ pet ở tầng OS — đợt B · 🔴 đường găng

Chạy một mình, desktop yên tĩnh. Phụ thuộc `SP-0/mac`.

```text
Đọc docs/spike-roadmap.md mục 3 và docs/spike-roadmap-macos.md mục 3 rồi thực
hiện SP-7/mac.

SPIKE SP-7/mac — Hành vi cửa sổ pet ở tầng hệ điều hành (macOS)
Thư mục: spikes/SP-7-pet-window-os/macos/
Đọc thêm: FR-INT-04, Phụ lục A.3.4, A.10 (E1, E2, E3, E6), FR-PET-01/07,
          FR-INT-14, ADR-009 (đoạn napi-rs)
Đối chiếu BẮT BUỘC: spikes/SP-7-pet-window-os/REPORT.md — bản Windows kết luận
          Electron thuần CƯỚP focus 6/10 lần và BẮT BUỘC phải xuống native
          module (WS_EX_NOACTIVATE + WM_NCHITTEST). Câu hỏi của session này là:
          trên macOS có cùng kết luận đó không, và nếu có thì phạm vi native
          rộng bằng nào.
Tái dùng: script của spikes/SP-0-gui-harness/macos/src/

BỐI CẢNH: PRD gọi FR-INT-04 là yêu cầu cứng — "vi phạm là phá vỡ lời hứa cốt
lõi không đứt mạch". R-3 của PRD nêu đích danh macOS là chỗ khó nhất của yêu
cầu này. Đây là lý do SP-7/mac nằm trên đường găng.

Q1. 🔴 Card tự bung mà KHÔNG cướp keyboard focus — Electron API thuần làm được
    không? macOS không có WS_EX_NOACTIVATE; các đường cần thử ít nhất: cửa sổ
    không nhận focus, kiểu cửa sổ panel, hiện cửa sổ mà không kích hoạt app, và
    ẩn app khỏi Dock. Nếu thuần Electron không đủ thì phải xuống native tới mức
    nào (panel không kích hoạt của AppKit)? Trả lời bằng bài test bên dưới.
Q2. Click-through theo từng pixel: vùng trong suốt cho chuột xuyên qua, vùng
    nhân vật nhận click. Electron có cơ chế bỏ qua sự kiện chuột kèm chuyển
    tiếp — nó đủ chính xác ở viền nhân vật chưa, lệch bao nhiêu pixel? macOS
    không có WM_NCHITTEST, nêu rõ cơ chế thay thế đã thử.
Q3. Always-on-top có đè lên ứng dụng fullscreen native không (E6)? Thử cả:
    app fullscreen thật, Mission Control đang mở, Stage Manager đang bật, và
    khi người dùng chuyển sang Space khác. Pet có theo sang Space mới không,
    hay đứng lại ở Space cũ? Đây là hành vi macOS không có đối ứng trên Windows.
Q4. Đa màn hình khác scale (Retina 2x + màn ngoài 1x): toạ độ nhớ qua phiên
    (FR-PET-01) còn đúng khi cấu hình màn hình đổi không? Tháo màn hình đang
    chứa pet (E2) thì sao? Nếu chỉ có một màn hình, ghi CHƯA KIỂM CHỨNG kèm
    lý do, không suy đoán.
Q5. Ô thoại tự chọn hướng mở khi pet sát mép (E1): lấy được vùng hiển thị khả
    dụng chính xác không — có trừ đúng menu bar, Dock (kể cả khi Dock tự ẩn và
    khi Dock nằm bên trái/phải), và NOTCH trên MacBook đời mới không? Thử cả 4
    góc và vùng ngay dưới notch.
Q6. Tray icon trên menu bar + thông báo hệ thống khi pet ẩn (FR-INT-14, E3):
    hoạt động không, có cần quyền Notifications không, và Focus / Do Not Disturb
    đang bật thì thông báo đi đâu?
Q7. Pet có xuất hiện trong Dock và trong App Switcher (Cmd-Tab) không? Nếu ẩn
    app khỏi Dock để tránh cướp focus thì App Window (cửa sổ quản lý, ADR-002)
    bị ảnh hưởng gì — hai cửa sổ trong một process, một cái cần xuất hiện bình
    thường, một cái cần vô hình? Đây là ràng buộc macOS không có trên Windows
    và nó chạm thẳng vào ADR-002.

VIỆC PHẢI LÀM — BÀI TEST Q1 LÀ QUAN TRỌNG NHẤT
- Prototype cửa sổ pet: trong suốt, frameless, always-on-top.
- Mở một editor, bơm chuỗi 200 ký tự đã biết bằng script SP-0/mac; GIỮA CHỪNG
  cho cửa sổ pet tự bung một panel. Đếm ký tự thực nhận. Mất dù chỉ 1 ký tự
  = FAIL.
- Chạy 10 lần liên tiếp, báo tỉ lệ, ĐẶT CẠNH tỉ lệ 6/10 của bản Windows.
- Nếu Electron thuần fail: dựng bản native tối thiểu và chạy lại 10 lần để biết
  native có cứu được không. Đây là dữ liệu quyết định phạm vi workstream native.
- Mỗi câu hỏi còn lại: chụp màn hình vào macos/evidence/ và tự đọc ảnh để kết luận.

GIỚI HẠN PHẦN CỨNG: xem mục 3.9 — Q4 (hai màn hình khác scale) và phần notch
của Q5 có thể không đo được trên Mac mini. Ghi CHƯA KIỂM CHỨNG kèm lý do, không
suy đoán.

TIÊU CHÍ ĐẠT: Q1 có kết luận dứt khoát kèm số liệu 10 lần chạy cho mỗi phương
án đã thử. Nếu cần native module → ghi rõ phạm vi (API nào, bao nhiêu mặt) để
ước lượng workstream; nói rõ nó CHUNG hay RIÊNG so với phạm vi native mà bản
Windows đã kết luận, vì hai phạm vi khác nhau nghĩa là hai lần viết chứ không
phải một.
```

---

### SP-11/mac · Keychain — đợt C · chạy song song được với SP-12/mac

```text
Đọc docs/spike-roadmap.md mục 3 và docs/spike-roadmap-macos.md mục 3 rồi thực
hiện SP-11/mac.

SPIKE SP-11/mac — Secure storage trên macOS (Keychain)
Thư mục: spikes/SP-11-secure-storage/macos/
Đọc thêm: NFR-SEC-01, FR-CF-11, FR-AG-11, FR-BE-02, FR-BE-12
Đối chiếu BẮT BUỘC: spikes/SP-11-secure-storage/REPORT.md — bản Windows chốt
          dùng safeStorage của Electron (DPAPI + AES-256-GCM), ciphertext lưu
          trong SQLite, và ghi rõ mục "Cơ chế Keychain trên macOS: CHƯA KIỂM
          CHỨNG". Session này lấp đúng ô đó.

Q1. safeStorage trên macOS thực sự dùng Keychain chứ không phải thứ khác —
    chứng minh bằng cách nào? Mục nào xuất hiện trong Keychain Access, tên
    service và account là gì? `isEncryptionAvailable()` trả gì, và gọi trước
    khi app 'ready' thì sao?
Q2. Giới hạn kích thước: bản Windows phải xử lý giới hạn từng mục của
    Credential Manager. Keychain có giới hạn tương tự không? Thử payload thật:
    token Notion (~50 ký tự), refresh token Google (~100+), client JSON BYO
    (~400 byte, FR-CF-11), và một ca cố tình lớn (64KB) để tìm ngưỡng. Nếu
    không có ngưỡng thì mô hình chia nhỏ của bản Windows có thể bỏ trên macOS —
    nói rõ điều đó.
Q3. 🔴 ACL của Keychain gắn với chữ ký mã. Dựng ba trạng thái: build chưa ký,
    build ký ad-hoc, build ký kiểu Developer ID (hoặc self-signed thay thế nếu
    chưa có chứng chỉ). Ghi một secret bằng bản này rồi ĐỌC bằng bản kia:
    - còn giải mã được không?
    - có bật lại hộp thoại "...muốn dùng thông tin bí mật lưu trong keychain"?
    Đây là câu quan trọng nhất của session. Nếu mỗi lần auto-update (FR-BE-09)
    đều làm người dùng phải nhập lại mật khẩu máy thì luồng cập nhật và
    onboarding phải thiết kế khác, và điều đó chạm vào SP-16/mac lẫn SP-22.
Q4. Người dùng bấm Deny, hoặc Keychain đang khoá: app phát hiện được không, xử
    lý ra sao, hiện SYSTEM card gì (Phụ lục A.2)? "Always Allow" lưu ở đâu và
    người dùng rút lại bằng cách nào?
Q5. Ciphertext gắn với cái gì — máy, tài khoản người dùng, hay đồng bộ qua
    iCloud Keychain? Thử: đăng nhập tài khoản macOS thứ hai; và nếu làm được,
    thử khôi phục từ Time Machine. Câu này quyết định cái gì BẮT BUỘC phải chép
    lại từ backend khi người dùng đổi máy (Nguyên tắc VII của constitution).
Q6. Mô hình đặt tên khoá (service/account) nên thế nào, và xoá tài khoản
    (FR-BE-12) có xoá sạch mọi mục không? Đối chiếu bằng công cụ dòng lệnh
    `security` để chứng minh không còn sót.

VIỆC PHẢI LÀM: prototype ghi/đọc/xoá thật; ca dung lượng lớn; ca bị từ chối
quyền; và ba trạng thái chữ ký ở Q3.
TIÊU CHÍ ĐẠT: Q3 có kết luận dứt khoát kèm log của cả ba trạng thái chữ ký.
Chốt được mô hình khoá dùng chung cho cả hai OS, hoặc nói rõ vì sao không chung
được.
```

---

### SP-12/mac · Native rebuild + độ bền ghi — đợt C · chạy song song được với SP-11/mac

```text
Đọc docs/spike-roadmap.md mục 3 và docs/spike-roadmap-macos.md mục 3 rồi thực
hiện SP-12/mac.

SPIKE SP-12/mac — better-sqlite3 trên macOS: ABI, đóng gói, và độ bền ghi
Thư mục: spikes/SP-12-sqlite-ledger/macos/
Đọc thêm: ADR "Local store", FR-LG-01, NFR-RL-03, constitution Nguyên tắc III
Đối chiếu BẮT BUỘC: spikes/SP-12-sqlite-ledger/REPORT.md — phần logic chạy trên
          Linux và phần Q1 rebuild chạy trên Windows đều đã xong, gồm bộ script
          crash injection. Session này CHẠY LẠI đúng bộ đó trên macOS.

Q1. Prebuild cho ABI Electron trên darwin có sẵn không (report Linux đã ghi
    nhận có prebuilds/darwin-arm64.node và darwin-x64.node), hay vẫn phải biên
    dịch tại chỗ? Kiến trúc máy này là gì và lấy đúng bản nào?
Q2. Nếu phải biên dịch: cần đúng những gì (Xcode Command Line Tools bản nào,
    Python nào), mất bao lâu? @electron/rebuild chạy trót lọt không?
Q3. 🔴 ĐỘ BỀN GHI — câu quan trọng nhất và là lý do session này không suy ra
    được từ Linux hay Windows. Trên macOS, fsync() KHÔNG bảo đảm dữ liệu rời
    khỏi cache của ổ đĩa; SQLite có cơ chế riêng để yêu cầu flush thật
    (F_FULLFSYNC, bật qua PRAGMA). Chạy lại NGUYÊN BỘ script crash injection
    của phần logic, ở CẢ HAI chế độ bật và tắt, rồi trả lời:
    - có mất bản ghi ledger đã báo commit không, ở chế độ nào, bao nhiêu lần
      trên bao nhiêu lần thử?
    - "ghi ledger trước khi thực thi, fail-closed" (Nguyên tắc III) còn đứng
      vững trên macOS không, và với cấu hình nào?
    - giá phải trả của chế độ an toàn là bao nhiêu (số ghi mỗi giây của hai
      chế độ, đo thật)?
    Nếu kết luận là phải bật chế độ an toàn thì đó là một dòng cấu hình BẮT BUỘC
    trong spec của ledger, không phải khuyến nghị.
Q4. File locking và WAL trên APFS: hành vi file shm/wal, nhiều process cùng mở,
    và ổ đĩa bật FileVault có đổi kết luận không? Đối chiếu với nhận định ở
    SP-21 rằng Windows và macOS chỉ giữ 1 file lock + 1 cặp shm/wal.
Q5. electron-builder đóng gói có mang theo native module đúng không? Bản
    universal (arm64 + x64) có mang đúng cả hai binary không, hay phải build
    riêng từng kiến trúc? Ghi số đo kích thước gói của từng phương án.

TIÊU CHÍ ĐẠT: chạy được crash injection trên macOS ở cả hai chế độ với số liệu
đối chiếu rõ ràng so với Linux và Windows; ghi chính xác danh sách toolchain
phải cài và cấu hình bắt buộc của SQLite trên macOS.
```

---

### SP-3/mac · Electron + Rive — đợt D · một mình, CPU phải yên

```text
Đọc docs/spike-roadmap.md mục 3 và docs/spike-roadmap-macos.md mục 3 rồi thực
hiện SP-3/mac.

SPIKE SP-3/mac — Stack render pet (Electron + Rive) trên macOS
Thư mục: spikes/SP-3-electron-rive/macos/
Đọc thêm: ADR-001, ADR-002, FR-PET-01/02, NFR-PF-01/04, R-3
Đối chiếu BẮT BUỘC: spikes/SP-3-electron-rive/REPORT.md — bản Windows kết luận
          ĐI: giữ 60fps khi CPU tải nặng, chuyển trạng thái 2.9–15.1ms, nền
          trong suốt sạch không viền. Session này đo lại cùng các chỉ số đó
          trên macOS.
Tái dùng: script chụp màn hình của spikes/SP-0-gui-harness/macos/src/

LƯU Ý: ADR-001/002 đã chốt stack, nên đây là spike KIỂM CHỨNG chứ không phải
lựa chọn. Nhiệm vụ là tìm xem stack đã chốt có gãy ở đâu trên macOS không.

Q1. Rive trong cửa sổ trong suốt/frameless đạt ≥30fps khi máy đang tải ~70% CPU
    không (NFR-PF-04)? Đo bằng bộ đếm khung hình trong app, không ước lượng.
    Đo thêm hai ca chỉ có trên macOS: màn ProMotion 120Hz (khung hình chạy 120
    hay bị khoá 60?) và màn ngoài 60Hz nối kèm.
Q2. State machine Rive ánh xạ 1:1 với 5 trạng thái pet được không, đổi trạng
    thái dưới 2s không (FR-PET-02)? Chụp từng trạng thái. Dùng đúng file .riv
    và contract state machine mà bản Windows đã lập.
Q3. Nền trong suốt + anti-alias viền nhân vật trên màn Retina 2x có sạch không?
    Chụp rồi ĐỌC GIÁ TRỊ PIXEL ở viền, chính xác hơn nhìn mắt. So thẳng với
    ma trận pixel bản Windows đã đo.
Q4. CPU/RAM khi pet idle, VÀ mức tiêu thụ năng lượng — đây là rủi ro riêng của
    macOS vì phần lớn máy là laptop chạy pin và hệ điều hành phạt nặng tiến
    trình nền tốn điện. Đo bằng công cụ đo năng lượng của hệ thống, ghi số cụ
    thể. Thêm hai ca: cửa sổ bị che hoàn toàn, và pet nằm ở Space không hiển thị
    — khung hình có bị hệ thống bóp lại không, và điều đó làm pet "chết cứng"
    khi người dùng quay lại không?
Q5. Render có chạy qua GPU không hay rơi về phần mềm khi cửa sổ trong suốt?
    Bằng chứng là gì?
Q6. Máy ngủ → thức, hoặc màn hình ngủ → bật: animation tiếp tục đúng hay treo /
    nhảy khung? Đây là ca biên mà bản Windows chưa đo.
Q7. Pipeline asset .riv nạp động: xác nhận nhanh là giống Windows, hoặc chỉ ra
    chỗ khác.

KHÔNG lặp lại: câu hỏi giấy phép Rive đã kết luận ở bản Windows (runtime MIT,
dùng thương mại tự do). Không mở lại.

VIỆC PHẢI LÀM
- Dùng đúng file .riv mẫu của bản Windows để hai bên so được.
- Tự tạo tải CPU bằng script, không chờ máy tình cờ bận.
- Quay hoặc chụp chuỗi ảnh vào macos/evidence/.

GIỚI HẠN PHẦN CỨNG: xem mục 3.9 — Mac mini không có màn hình ProMotion và
không có pin. Đo ở tần số quét thật của màn hình đang gắn và ghi rõ tần số đó;
đo công suất tiêu thụ bằng công cụ hệ thống nhưng không quy đổi ra mức hao pin.

TIÊU CHÍ ĐẠT: có số fps thật ở tần số quét của màn hình đang dùng + bằng chứng thị giác về viền;
Q4 có số đo năng lượng cụ thể, vì đó là dữ liệu quyết định pet có được phép
chạy nền cả ngày trên laptop hay không.
```

---

### SP-18/mac · Pet như một thực thể sống — đợt E · 🔴 quyết định kiến trúc M3

Phụ thuộc `SP-7/mac` (kết luận về native module) và `SP-3/mac` (state machine).
Session nhiều câu hỏi nhất của loạt. Phép đo độ bền chạy nền, không ai phải ngồi chờ — xem Q3.

```text
Đọc docs/spike-roadmap.md mục 3 và docs/spike-roadmap-macos.md mục 3 rồi thực
hiện SP-18/mac.

SPIKE SP-18/mac — Pet như một thực thể sống trên desktop macOS
Thư mục: spikes/SP-18-pet-liveness/macos/
Đọc thêm: FR-PET-01/02/03/07, FR-INT-04, FR-INT-11/12, Phụ lục A.1, A.7, A.8,
          A.10 (E1, E2, E6), S-S1, docs/raw-idea/idea-brief.md
Đối chiếu BẮT BUỘC: spikes/SP-18-pet-liveness/REPORT.md — bản Windows chốt
          Kiến trúc A (cửa sổ nhỏ tự di chuyển) và loại Kiến trúc B (overlay
          toàn màn hình), kèm bộ lọc riêng tư Zero-Persistent Title. Session
          này đo lại ngã rẽ đó trên macOS: cùng kết luận hay khác.
Phụ thuộc: đọc spikes/SP-7-pet-window-os/macos/REPORT.md và
          spikes/SP-3-electron-rive/macos/REPORT.md trước khi bắt đầu.
Tái dùng: script của spikes/SP-0-gui-harness/macos/src/

═══════════════════════════════════════════════════════════════
CÂU HỎI TRUNG TÂM
═══════════════════════════════════════════════════════════════
Q0. Kiến trúc cửa sổ nào trên macOS? Dựng prototype CẢ HAI rồi so bằng số đo:
  A. CỬA SỔ NHỎ TỰ DI CHUYỂN — cửa sổ ~200x200 bám sát pet, dời liên tục.
  B. OVERLAY TOÀN MÀN HÌNH — một cửa sổ trong suốt phủ desktop, xuyên chuột
     toàn bộ trừ vùng pet.
  So sánh bắt buộc: độ mượt khi di chuyển (fps, có xé hình/nhấp nháy không),
  CPU/GPU/RAM/năng lượng lúc di chuyển và lúc đứng yên, độ chính xác xuyên
  chuột, hành vi khi đi qua ranh giới hai màn hình khác scale, khả năng vẽ đè
  lên cửa sổ khác, hành vi khi chuyển Space và khi Stage Manager bật, và mức
  tiêu thụ theo thời gian chạy liên tục (dùng cửa sổ đo ngắn ở Q3, không chờ).
  Bản Windows chọn A. Nếu macOS cũng chọn A thì nói rõ vì sao; nếu khác thì
  đây là ngã rẽ kiến trúc PHẢI trình product owner, vì hai OS chọn hai kiến
  trúc khác nhau nghĩa là hai lần viết lớp pet.

═══════════════════════════════════════════════════════════════
NHÓM A — DI CHUYỂN
═══════════════════════════════════════════════════════════════
Q1. Di chuyển liên tục ở 60fps (và 120fps trên ProMotion) có mượt không? Đo fps
    thật, chụp chuỗi ảnh kiểm tra xé hình. So khi máy tải 0% và 70% CPU.
Q2. Đi qua ranh giới hai màn hình khác scale (Retina 2x ↔ màn ngoài 1x): pet
    có nhảy kích thước, lệch toạ độ, hay kẹt ở mép không?
Q3. ĐỘ BỀN (NFR-RL-04 yêu cầu chạy liên tục 8 giờ không crash, không rò rỉ).
    Chia làm hai phần, KHÔNG ngồi chờ phần nào:
    a. Trong session: cho pet di chuyển liên tục 60–90 phút, lấy mẫu RAM và số
       đối tượng đồ hoạ mỗi 5 phút, rồi tính ĐỘ DỐC. Dốc phẳng thì trả lời
       được ngay câu "có rò rỉ nhanh không"; dốc đi lên là kết luận KHÔNG ĐI
       mà không cần chạy tiếp.
    b. Chạy nền: trước khi đóng session, khởi động một tiến trình đo tách rời
       (theo kết luận SP-0/mac Q6) chạy đủ 8 giờ và ghi mẫu ra file mỗi 15
       phút. Session sau đọc file, kết luận, và bổ sung vào chính REPORT này.
    Ghi rõ trong report phần nào là số đo 90 phút và phần nào là số đo 8 giờ.
    LƯU Ý ĐỐI CHIẾU: bản Windows trả lời câu này bằng ~15.000 frame — khoảng 4
    phút ở 60fps — chứ chưa từng chạy đủ 8 giờ. Nên số 8 giờ của macOS sẽ là
    bằng chứng đầu tiên có thật cho NFR-RL-04, và nếu nó lộ ra rò rỉ thì kết
    luận của bản Windows phải đo lại.
Q4. Pet đi ra ngoài vùng hiển thị, lên menu bar, lên Dock, hoặc vào vùng notch
    thì sao? Có tự kéo lại được không?

═══════════════════════════════════════════════════════════════
NHÓM B — KÉO THẢ (FR-PET-01)
═══════════════════════════════════════════════════════════════
Q5. Kéo được pet khi đã bật xuyên chuột theo pixel không? Hit-test có chính xác
    ở viền nhân vật không?
Q6. Kéo có bám con trỏ mượt không, trễ bao nhiêu ms? Đo bằng script di chuột
    theo quỹ đạo định sẵn rồi đối chiếu vị trí pet.
Q7. Thả pet ở: mép màn hình, góc, nửa trong nửa ngoài, trên Dock, trên menu bar,
    trên màn hình phụ. Mỗi ca ghi hành vi thực tế.
Q8. Quán tính khi thả và bám mép có khả thi không?
Q9. Vị trí nhớ qua phiên còn đúng khi cấu hình màn hình đổi giữa hai phiên không?

═══════════════════════════════════════════════════════════════
NHÓM C — PET NHẬN BIẾT MÀN HÌNH  ⭐ khác Windows nhiều nhất
═══════════════════════════════════════════════════════════════
Trên Windows nhóm này chỉ tốn API. Trên macOS nó tốn QUYỀN, và các quyền đó ở
ba mức khác nhau — đây chính là phần không suy ra được từ bản Windows.

Q10. Liệt kê được cửa sổ đang mở, vị trí, kích thước không, và CẦN QUYỀN GÌ?
     Lấy được danh sách mà KHÔNG có tiêu đề thì có cần quyền không? Đo thật,
     đừng đọc tài liệu.
Q11. Lấy được TIÊU ĐỀ cửa sổ không, và nó đòi quyền nào? Nếu tiêu đề đòi quyền
     Screen Recording thì nêu rõ: bật tính năng này nghĩa là bắt người dùng
     cấp quyền quay màn hình cho một con pet. Đó là một quyết định sản phẩm,
     phải nêu thành đề xuất trong report chứ không tự quyết.
Q12. Biết cửa sổ / app nào đang foreground không, và theo dõi realtime được
     không? Có đường nào KHÔNG cần quyền không (thông báo đổi app đang kích
     hoạt ở tầng workspace) so với đường cần quyền Accessibility? Chi phí CPU
     khi theo dõi liên tục là bao nhiêu?
Q13. Pet "đậu" lên mép một cửa sổ khác và DI CHUYỂN THEO khi cửa sổ đó bị kéo —
     khả thi không, trễ bao nhiêu ms, có giật không?
Q14. Pet chỉ tay / vẽ highlight lên vùng của cửa sổ khác được không?
Q15. Biết người dùng đang gõ ở đâu (vị trí con trỏ nhập liệu qua Accessibility)
     không? Cần quyền gì?
Q16. ⚠️ RIÊNG TƯ: liệt kê CHÍNH XÁC những gì pet đọc được từ môi trường ở mỗi
     mức quyền, và đề xuất ranh giới tối thiểu đủ dùng. Bản Windows đã chốt bộ
     lọc Zero-Persistent Title — bộ lọc đó áp dụng nguyên vẹn trên macOS được
     không, hay macOS cần ranh giới chặt hơn vì quyền đã bao trùm hơn? Đây là
     đầu vào bắt buộc cho NFR-SEC-02.

═══════════════════════════════════════════════════════════════
NHÓM D — KHÔNG CẢN TRỞ CÔNG VIỆC (nguyên tắc A.7)
═══════════════════════════════════════════════════════════════
Q17. 🔴 Trong lúc pet ĐANG DI CHUYỂN, gõ 200 ký tự vào editor — có mất ký tự
     nào không? Đây là FR-INT-04 ở trạng thái động, nghiêm ngặt hơn bài test
     của SP-7/mac. Chạy 10 lần, báo tỉ lệ.
Q18. Pet tự tránh vùng con trỏ / vùng đang gõ được không? Trễ bao nhiêu?
Q19. Pet có vô tình nhận chuột/phím của người dùng khi đi ngang qua chỗ họ đang
     thao tác không?

═══════════════════════════════════════════════════════════════
NHÓM E — TRẠNG THÁI × CHUYỂN ĐỘNG
═══════════════════════════════════════════════════════════════
Q20. Rive state machine xử lý ĐỒNG THỜI trạng thái công việc (5 trạng thái) và
     trạng thái vận động (đứng/đi/bị kéo/rơi) được không? Cần state machine
     phân tầng hay một tầng đủ? Đối chiếu kết luận bản Windows.
Q21. Chuyển trạng thái giữa lúc đang di chuyển có mượt không?
Q22. Ô thoại neo vào pet ĐANG DI CHUYỂN: bám theo mượt không, tự đổi hướng mở
     khi tới gần mép / notch trong lúc đang chạy không (E1)?

═══════════════════════════════════════════════════════════════
NHÓM F — CA BIÊN NGHIỆT NGÃ
═══════════════════════════════════════════════════════════════
Q23. Khoá máy → mở lại: pet còn đúng vị trí và trạng thái không?
Q24. Máy ngủ → thức: animation tiếp tục đúng hay treo?
Q25. Đổi độ phân giải hoặc scale GIỮA CHỪNG khi pet đang di chuyển?
Q26. Tháo màn hình đang chứa pet KHI PET ĐANG DI CHUYỂN (E2)?
Q27. App fullscreen bật lên khi pet đang chạy ngang (E6)? Chuyển Space, mở
     Mission Control, bật Stage Manager trong lúc pet đang di chuyển?
Q28. Zoom màn hình, Increase Contrast, hoặc VoiceOver đang bật?
Q29. Chia sẻ màn hình / AirPlay / Sidecar — pet có xuất hiện trong bản ghi hoặc
     trong luồng chia sẻ không? Có cách ẩn pet khỏi bản chia sẻ không? Đây là
     ca biên macOS không có trong danh sách của bản Windows và nó là vấn đề
     riêng tư thật: người dùng chia sẻ màn hình trong cuộc họp.
Q30. 🔴 FR-PET-03 — TRẢ FOCUS về cửa sổ trước đó. Đóng ô thoại bằng Esc hoặc
     click ra ngoài thì focus phải quay về ĐÚNG app người dùng đang làm việc
     trước đó. Nhớ và khôi phục app đang foreground trên macOS làm được bằng
     API thuần không, hay phải xuống native? Nếu cần native thì phạm vi
     workstream rộng hơn ước lượng của SP-7/mac — phải nói rõ.

═══════════════════════════════════════════════════════════════
VIỆC PHẢI LÀM
═══════════════════════════════════════════════════════════════
- Prototype CẢ HAI kiến trúc ở Q0.
- Tự động hoá bằng script SP-0/mac: di chuột theo quỹ đạo, bơm phím, chụp chuỗi
  ảnh để phát hiện xé hình.
- Phép đo độ bền theo hai phần ở Q3: cửa sổ 90 phút trong session, và tiến trình 8 giờ chạy nền đọc kết quả ở session sau.
- Mỗi câu hỏi có bằng chứng: số đo, chuỗi ảnh, hoặc log.

═══════════════════════════════════════════════════════════════
ĐẦU RA BẮT BUỘC NGOÀI REPORT.md
═══════════════════════════════════════════════════════════════
1. macos/evidence/architecture-decision.md — so sánh A và B bằng bảng số liệu,
   khuyến nghị dứt khoát, VÀ một mục riêng: kết luận này có trùng với quyết
   định Kiến trúc A của bản Windows không. Nếu không trùng, nêu hai phương án
   cho product owner (một lớp pet chung cho hai OS, hay hai lớp riêng) kèm giá
   phải trả của mỗi phương án.
2. macos/evidence/interaction-catalogue.md — với MỖI ca Q1–Q30: hành vi thực tế
   quan sát được, đạt/không đạt, ghi chú thiết kế.
3. macos/evidence/privacy-surface.md — chính xác những gì pet đọc được ở mỗi mức
   quyền (Q16), và ranh giới tối thiểu đề xuất.

GIỚI HẠN PHẦN CỨNG: xem mục 3.9 — Q1 (120Hz), Q2 (hai màn hình khác scale),
Q3 (mức hao pin), Q4 (notch) và Q29 (Sidecar/AirPlay) phụ thuộc phần cứng Mac
mini có thể không có. Ghi CHƯA KIỂM CHỨNG kèm lý do.

LƯU Ý VỀ PHÉP ĐO DÀI: không có phần nào của session này bắt người ngồi chờ.
Phần 8 giờ ở Q3 chạy nền sau khi session đóng, ghi số đo ra file, và session sau
đọc lại. Điều kiện là máy không ngủ và màn hình không khoá trong suốt thời gian
đó (theo kết luận SP-0/mac Q6).

TIÊU CHÍ ĐẠT
- Q0 có kết luận dứt khoát kèm số liệu, không lửng lơ.
- Q17 đạt — FR-INT-04 ở trạng thái động.
- Q10–Q15 có kết luận khả thi/không kèm quyền tương ứng, vì chúng quyết định
  pet có thể "phản ứng với việc agent đang làm" hay chỉ là animation vô hồn,
  và quyết định macOS phải xin những quyền nào.
```

---

### SP-16/mac · Ký số + notarization + auto-update — đợt F

Phần lớn là nghiên cứu + dry-run. **Không mua gì.**

```text
Đọc docs/spike-roadmap.md mục 3 và docs/spike-roadmap-macos.md mục 3 rồi thực
hiện SP-16/mac.

SPIKE SP-16/mac — Code signing, notarization và auto-update trên macOS
Thư mục: spikes/SP-16-signing-update/macos/
Đọc thêm: ADR-009, FR-BE-09, FR-APP-06, nguyên tắc PRD §1 (người dùng đầu tiên
          phải dùng qua ĐÚNG luồng chính thức, gồm auto-update)
Đối chiếu BẮT BUỘC: spikes/SP-16-signing-update/REPORT.md — bản Windows chạy
          trọn dry-run auto-update với cert tự ký và kết luận việc mua chứng
          chỉ KHÔNG chặn M0. Câu hỏi cốt lõi của session này: điều đó còn đúng
          trên macOS không.

LƯU Ý: KHÔNG tự ý mua gì. Việc mua là quyết định của product owner.

Q1. Chứng chỉ cần những gì: Developer ID Application, Developer ID Installer,
    và tài khoản Apple Developer. Giá công bố, chu kỳ gia hạn, và điều kiện —
    cá nhân đăng ký được không hay phải pháp nhân, cần giấy tờ gì, mất bao lâu?
    Ghi giá và thời gian từ nguồn công bố, đánh dấu rõ đâu là tra tài liệu chứ
    không phải đã chạy.
Q2. Hardened Runtime: Electron cần những entitlement nào để chạy được sau khi
    bật? Native module (napi-rs, nếu SP-7/mac kết luận cần) thêm entitlement
    nào? Ký thử bằng chữ ký ad-hoc hoặc tự tạo và ghi lại chính xác bước nào
    gãy, thông báo lỗi ra sao.
Q3. notarytool + stapler: quy trình gồm những bước nào, thời gian chờ thực tế
    bao lâu, và nó đòi những gì để xác thực? Nếu chưa có tài khoản Apple
    Developer → ghi CHƯA KIỂM CHỨNG kèm danh sách chính xác thứ cần có, KHÔNG
    suy đoán kết quả.
Q4. 🔴 DRY-RUN auto-update với chữ ký ad-hoc / tự ký: build → ký → publish
    manifest lên HTTP server cục bộ → app phát hiện bản mới → tải → cài → khởi
    động lại đúng phiên bản mới.
    Điểm phải kiểm chứng: cơ chế cập nhật của macOS kiểm tra chữ ký mã trước
    khi cài. Nếu bản tự ký bị từ chối thì bản Windows và bản macOS có kết luận
    NGƯỢC NHAU, và mốc phải mua chứng chỉ bị kéo sớm lên — đây là câu quyết
    định lịch mua sắm. Ghi rõ gãy ở bước nào, thông báo lỗi nguyên văn.
    Xác nhận luôn: manifest và định dạng gói nào là bắt buộc trên macOS, có
    phải kèm thêm gói nén cạnh file cài không?
Q5. Gatekeeper và quarantine: bản tải về từ HTTP cục bộ, chưa notarize, người
    dùng thấy gì ở lần mở đầu tiên? Có đường nào qua được mà không dạy người
    dùng thói quen xấu không?
Q6. Auto-update khi app đang chạy nền và còn job đang chạy (FR-APP-06): hành vi
    thoát và khởi động lại trên macOS ra sao?
Q7. Universal binary (arm64 + x64) so với hai bản riêng: kích thước tải, thời
    gian ký và notarize, và số bản phải giữ trong manifest. Khuyến nghị chọn gì.
Q8. Quyền đã cấp và secret trong Keychain có sống sót qua auto-update không?
    Câu này nối thẳng với SP-11/mac Q3 và SP-22 Q4 — nếu mỗi bản cập nhật đều
    làm người dùng phải cấp lại quyền và nhập lại mật khẩu keychain thì
    auto-update trên macOS là một vấn đề trải nghiệm, không chỉ là kỹ thuật.

ĐẦU RA BẮT BUỘC
- macos/evidence/procurement-checklist-macos.md — mua gì, ở đâu, giá bao nhiêu,
  mất bao lâu, cần giấy tờ gì. Viết nối tiếp checklist Windows đã có để product
  owner nhìn thấy tổng chi phí ký số của cả hai OS trong một chỗ. Để trống ô
  "cá nhân hay pháp nhân" cho product owner điền.

TIÊU CHÍ ĐẠT: Q4 có kết luận dứt khoát — dry-run chạy trọn được hay không, và
nếu không thì mốc bắt buộc phải mua chứng chỉ là khi nào. Checklist có giá và
thời gian cụ thể.
```

---

### SP-22 · Quyền TCC và onboarding macOS — đợt G · CHẠY CUỐI CÙNG

Spike chỉ có trên macOS, không có bản Windows đối ứng.
⚠️ Session này cố ý thu hồi quyền của máy. Chạy sau khi mọi spike khác đã xong.

```text
Đọc docs/spike-roadmap.md mục 3 và docs/spike-roadmap-macos.md mục 3 rồi thực
hiện SP-22.

SPIKE SP-22 — Quyền hệ thống (TCC) và onboarding trên macOS
Thư mục: spikes/SP-22-macos-permissions/
Đọc thêm: WF-1 Onboarding và §10.7 của docs/raw-idea/prd-mvp.md, NFR-SEC-02,
          FR-APP-03, FR-INT-14, ADR-009
Phụ thuộc: đọc trước macos/REPORT.md của SP-0, SP-7, SP-11, SP-18 — bốn session
          đó đã gặp hộp thoại quyền thật và đã ghi lại; session này tổng hợp,
          đo ranh giới, và biến thành đặc tả onboarding.

⚠️ CHẠY CUỐI CÙNG. Session này thu hồi quyền để dựng lại ca "máy mới", và việc
đó thu hồi luôn quyền của chính tiến trình agent. Đừng chạy khi còn spike khác
chưa xong.

BỐI CẢNH: Windows gần như không hỏi gì khi cài app. macOS hỏi từng quyền một,
mỗi lần một hộp thoại, và một số quyền bắt người dùng tự vào System Settings
bật tay rồi khởi động lại app. Sản phẩm có một con pet luôn hiện trên màn hình
và (ở M3) muốn biết trên màn hình đang có gì — đó là đúng nhóm quyền nhạy cảm
nhất của macOS. Chưa spike nào trả lời: MVP cần bao nhiêu quyền, và luồng xin
quyền trông ra sao.

Q1. Lập ma trận ĐẦY ĐỦ: mỗi quyền × tính năng nào cần nó × thiếu thì mất gì ×
    MVP có cần không hay để tới M3. Ít nhất phải phủ: quay/chụp màn hình, điều
    khiển hỗ trợ (Accessibility), theo dõi bàn phím (Input Monitoring), điều
    khiển app khác (Automation/Apple Events), thông báo, khởi động cùng máy,
    và truy cập thư mục. Mỗi ô phải dựa trên kết quả đã đo ở các spike trước,
    không tự suy.
Q2. Xin quyền chủ động được không — app tự bật hộp thoại đúng lúc nó cần, hay
    hộp thoại chỉ hiện khi app chạm vào API? Mở thẳng đúng trang trong System
    Settings từ trong app được không?
Q3. Người dùng từ chối rồi thì sao: app TỰ BIẾT là đang thiếu quyền không (có
    API hỏi trạng thái mà không bật hộp thoại không)? Xin lại lần hai được
    không hay bắt buộc vào System Settings bật tay? Bật xong app có phải khởi
    động lại mới nhận không? Ba câu này quyết định hình dạng luồng onboarding,
    phải đo từng cái.
Q4. Quyền gắn với chữ ký và bundle id: đổi chữ ký, đổi bundle id, hay auto-update
    lên bản mới thì quyền đã cấp còn không? Nối với SP-11/mac Q3 và SP-16/mac Q8.
    Nếu mỗi bản cập nhật đều bắt cấp lại quyền thì đó là lỗi trải nghiệm nghiêm
    trọng phải giải quyết ở M1, không phải M3.
Q5. Khởi động cùng máy: đăng ký bằng cơ chế nào trên macOS 13+, người dùng thấy
    gì trong System Settings, tự tắt được không, và app biết mình đã bị tắt
    không?
Q6. 🔴 Bản MVP — pet hiện trên màn hình, nhận lệnh, chạy job qua connector,
    KHÔNG có phần pet nhận biết màn hình — chạy được với ZERO quyền TCC không?
    Chứng minh bằng cách chạy thật trên một trạng thái quyền đã reset sạch.
    Nếu câu trả lời là CÓ thì onboarding macOS sạch, mọi hộp thoại quyền lùi về
    M3, và đó là một kết luận đáng giá cho lịch phát hành. Nếu KHÔNG thì nêu
    chính xác quyền tối thiểu và vì sao không bỏ được.
Q7. Reset quyền mô phỏng "máy mới" tới mức nào, và lặp lại được bao nhiêu lần?
    Ghi lại quy trình để sau này kiểm thử onboarding còn dựng lại được.

ĐẦU RA BẮT BUỘC
1. evidence/permission-matrix.md — ma trận Q1, dạng bảng, mỗi ô có bằng chứng.
2. evidence/onboarding-macos-draft.md — luồng onboarding đề xuất: thứ tự xin
   quyền, thời điểm xin, app nói gì ở mỗi bước, và hành vi khi người dùng từ
   chối. Kèm ảnh chụp từng hộp thoại thật. Đây là nội dung gốc cho phần
   onboarding macOS của đặc tả app.
3. evidence/permission-denied-behaviour.md — với MỖI quyền, app phải làm gì khi
   bị từ chối: tính năng nào tắt, SYSTEM card nào hiện (Phụ lục A.2), người
   dùng bật lại bằng cách nào.

TIÊU CHÍ ĐẠT: Q6 có kết luận dứt khoát kèm bằng chứng chạy thật trên trạng
thái quyền sạch. Ma trận Q1 không còn ô nào "chưa rõ".
```

---

## 6. SAU KHI CẢ LOẠT XONG

1. **Gỡ nhãn hoãn.** Tìm toàn repo các chuỗi "CHƯA KIỂM CHỨNG — macOS hoãn",
   "macOS hoãn", "UNVERIFIED on macOS" và thay bằng trích dẫn tới report macOS
   tương ứng. Điểm đã biết: `docs/spec/capabilities/platform/spec.md` dòng 20,
   và mục 5 của các REPORT Windows SP-3, SP-7, SP-11, SP-16, SP-18.
2. **Đưa kết luận vào spec.** Mỗi report mới có 4 mục bắt buộc phải được spec
   trích dẫn. Chạy `node plugins/specdocs/scripts/spec-check.mjs evidence` và
   xử lý hết `EVID_UNCITED`. Việc này đi qua một change của specdocs, không sửa
   thẳng `docs/spec/capabilities/`.
3. **Cập nhật `docs/spike-inputs.md` §5** — thay bảng "HOÃN macOS" bằng kết quả
   thật của từng ô.
4. **Kiểm tra ADR.** `SP-7/mac`, `SP-18/mac`, `SP-16/mac` là ba spike có khả
   năng lật ADR-002 (hai cửa sổ), ADR-009 (native escape hatch), hoặc lịch mua
   chứng chỉ. Nếu có → dừng và trình product owner, đúng quy tắc GATE.
5. **Ma trận NFR-CP-01.** Lập một bảng cuối cùng: mỗi yêu cầu nền tảng ×
   Windows × macOS × trạng thái. Đây là bằng chứng M0 đã phủ cả hai OS.
