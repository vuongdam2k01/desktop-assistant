#!/usr/bin/env python3
"""Sinh các sơ đồ và hình minh họa trực quan (SVG) cho byo-setup-guide-draft.md và REPORT.md.
Tạo các asset trực quan chuẩn Material Design của Google minh họa luồng setup và màn hình consent.
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent.parent
EVIDENCE_DIR = ROOT / "spikes" / "SP-13-byo-oauth-google" / "evidence"

def make_consent_flow_svg():
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 480" width="100%" height="100%">
  <defs>
    <style>
      .title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: bold; font-size: 20px; fill: #202124; }
      .desc { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; fill: #5f6368; }
      .box-title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 600; font-size: 15px; fill: #1a73e8; }
      .box-text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 12px; fill: #3c4043; line-height: 1.4; }
      .warn-title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: bold; font-size: 15px; fill: #d93025; }
      .step-badge { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: bold; font-size: 12px; fill: #ffffff; }
    </style>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.08"/>
    </filter>
  </defs>

  <rect width="1000" height="480" fill="#f8f9fa" rx="12"/>

  <!-- Tiêu đề -->
  <text x="40" y="45" class="title">QUY TRÌNH ỦY QUYỀN GOOGLE OAUTH 2.0 (BYO CLIENT &amp; VƯỢT CẢNH BÁO UNVERIFIED)</text>
  <text x="40" y="70" class="desc">Chế độ Serve loopback 127.0.0.1:8765 trên Desktop app — Người dùng duyệt quyền qua 4 thao tác click</text>

  <!-- Step 1: Chọn tài khoản -->
  <g transform="translate(30, 100)" filter="url(#shadow)">
    <rect width="170" height="320" rx="8" fill="#ffffff" stroke="#dadce0" stroke-width="1"/>
    <circle cx="28" cy="28" r="14" fill="#1a73e8"/>
    <text x="24" y="33" class="step-badge">1</text>
    <text x="50" y="33" class="box-title">Chọn tài khoản</text>
    <line x1="15" y1="52" x2="155" y2="52" stroke="#f1f3f4" stroke-width="1"/>
    
    <rect x="20" y="70" width="130" height="45" rx="6" fill="#f8f9fa" stroke="#e8eaed"/>
    <circle cx="38" cy="92" r="10" fill="#e8710a"/>
    <text x="55" y="88" style="font-family:sans-serif;font-size:10px;font-weight:bold;fill:#202124;"><account>...</text>
    <text x="55" y="102" style="font-family:sans-serif;font-size:9px;fill:#5f6368;">Test User</text>
    
    <text x="20" y="145" class="box-text">Người dùng click chọn</text>
    <text x="20" y="165" class="box-text">tài khoản đã đăng ký</text>
    <text x="20" y="185" class="box-text">trong danh sách</text>
    <text x="20" y="205" style="font-family:sans-serif;font-size:11px;font-weight:bold;fill:#d93025;">Test users.</text>
    <text x="20" y="240" style="font-family:sans-serif;font-size:11px;fill:#5f6368;">⚠️ Nếu chọn email</text>
    <text x="20" y="258" style="font-family:sans-serif;font-size:11px;fill:#5f6368;">khác sẽ bị lỗi 403</text>
    <text x="20" y="276" style="font-family:sans-serif;font-size:11px;fill:#5f6368;">access_denied.</text>
  </g>

  <!-- Step 2: Cảnh báo Unverified -->
  <g transform="translate(230, 100)" filter="url(#shadow)">
    <rect width="170" height="320" rx="8" fill="#ffffff" stroke="#f28b82" stroke-width="1.5"/>
    <circle cx="28" cy="28" r="14" fill="#d93025"/>
    <text x="24" y="33" class="step-badge">2</text>
    <text x="50" y="33" class="warn-title">Màn cảnh báo</text>
    <line x1="15" y1="52" x2="155" y2="52" stroke="#fce8e6" stroke-width="1"/>

    <path d="M 85 75 L 100 100 L 70 100 Z" fill="#d93025"/>
    <text x="83" y="96" style="font-family:sans-serif;font-size:12px;font-weight:bold;fill:#ffffff;">!</text>
    
    <text x="20" y="125" style="font-family:sans-serif;font-size:11px;font-weight:bold;fill:#d93025;">Google hasn't</text>
    <text x="20" y="142" style="font-family:sans-serif;font-size:11px;font-weight:bold;fill:#d93025;">verified this app</text>

    <rect x="20" y="165" width="130" height="28" rx="4" fill="#1a73e8"/>
    <text x="35" y="183" style="font-family:sans-serif;font-size:10px;fill:#ffffff;font-weight:bold;">Back to safety ❌</text>

    <text x="20" y="215" style="font-family:sans-serif;font-size:11px;font-weight:bold;fill:#1a73e8;text-decoration:underline;">Advanced (Nâng cao) 👉</text>
    
    <text x="20" y="250" class="box-text">KHÔNG bấm nút xanh.</text>
    <text x="20" y="270" class="box-text">Người dùng click vào</text>
    <text x="20" y="290" style="font-family:sans-serif;font-size:11px;font-weight:bold;fill:#1a73e8;">chữ Advanced.</text>
  </g>

  <!-- Step 3: Mở rộng Advanced -->
  <g transform="translate(430, 100)" filter="url(#shadow)">
    <rect width="170" height="320" rx="8" fill="#ffffff" stroke="#dadce0" stroke-width="1"/>
    <circle cx="28" cy="28" r="14" fill="#1a73e8"/>
    <text x="24" y="33" class="step-badge">3</text>
    <text x="50" y="33" class="box-title">Xác nhận bỏ qua</text>
    <line x1="15" y1="52" x2="155" y2="52" stroke="#f1f3f4" stroke-width="1"/>

    <text x="15" y="80" class="desc" style="font-size:11px;">Khu vực mở rộng:</text>
    <rect x="15" y="95" width="140" height="85" rx="4" fill="#f8f9fa" stroke="#e8eaed"/>
    <text x="22" y="115" style="font-family:sans-serif;font-size:9.5px;fill:#5f6368;">If you understand</text>
    <text x="22" y="130" style="font-family:sans-serif;font-size:9.5px;fill:#5f6368;">the risks to security...</text>
    
    <text x="22" y="160" style="font-family:sans-serif;font-size:10px;font-weight:bold;fill:#1a73e8;text-decoration:underline;">Go to Desktop</text>
    <text x="22" y="173" style="font-family:sans-serif;font-size:10px;font-weight:bold;fill:#1a73e8;text-decoration:underline;">Assistant (unsafe) 👉</text>

    <text x="15" y="210" class="box-text">Click liên kết</text>
    <text x="15" y="230" style="font-family:sans-serif;font-size:11px;font-weight:bold;fill:#202124;">"Go to ... (unsafe)"</text>
    <text x="15" y="250" class="box-text">để chuyển tiếp tới</text>
    <text x="15" y="270" class="box-text">màn hình cấp quyền.</text>
  </g>

  <!-- Step 4: Cấp quyền Scopes -->
  <g transform="translate(630, 100)" filter="url(#shadow)">
    <rect width="170" height="320" rx="8" fill="#ffffff" stroke="#dadce0" stroke-width="1"/>
    <circle cx="28" cy="28" r="14" fill="#1a73e8"/>
    <text x="24" y="33" class="step-badge">4</text>
    <text x="50" y="33" class="box-title">Tích chọn quyền</text>
    <line x1="15" y1="52" x2="155" y2="52" stroke="#f1f3f4" stroke-width="1"/>

    <text x="15" y="78" style="font-family:sans-serif;font-size:10px;fill:#202124;font-weight:bold;">Cấp quyền cho app:</text>
    
    <rect x="15" y="90" width="140" height="42" rx="4" fill="#e8f0fe"/>
    <text x="22" y="107" style="font-family:sans-serif;font-size:9.5px;fill:#174ea6;font-weight:bold;">☑️ Đọc Gmail</text>
    <text x="22" y="122" style="font-family:sans-serif;font-size:8.5px;fill:#5f6368;">gmail.readonly</text>

    <rect x="15" y="140" width="140" height="42" rx="4" fill="#e8f0fe"/>
    <text x="22" y="157" style="font-family:sans-serif;font-size:9.5px;fill:#174ea6;font-weight:bold;">☑️ Đọc Drive</text>
    <text x="22" y="172" style="font-family:sans-serif;font-size:8.5px;fill:#5f6368;">drive.readonly</text>

    <rect x="40" y="200" width="90" height="28" rx="4" fill="#1a73e8"/>
    <text x="55" y="218" style="font-family:sans-serif;font-size:11px;fill:#ffffff;font-weight:bold;">Continue 👉</text>

    <text x="15" y="255" class="box-text">Bắt buộc tích đủ 2 ô.</text>
    <text x="15" y="275" class="box-text">Bấm nút Continue.</text>
  </g>

  <!-- Step 5: Hoàn tất Loopback -->
  <g transform="translate(830, 100)" filter="url(#shadow)">
    <rect width="140" height="320" rx="8" fill="#e6f4ea" stroke="#ceead6" stroke-width="1"/>
    <circle cx="28" cy="28" r="14" fill="#137333"/>
    <text x="24" y="33" class="step-badge">✓</text>
    <text x="50" y="33" style="font-family:sans-serif;font-weight:bold;font-size:14px;fill:#137333;">Hoàn tất</text>
    <line x1="15" y1="52" x2="125" y2="52" stroke="#ceead6" stroke-width="1"/>

    <circle cx="70" cy="95" r="22" fill="#34a853"/>
    <text x="63" y="103" style="font-family:sans-serif;font-size:22px;fill:#ffffff;">✓</text>

    <text x="12" y="140" style="font-family:sans-serif;font-size:11px;font-weight:bold;fill:#137333;text-align:center;">Redirect về</text>
    <text x="12" y="158" style="font-family:sans-serif;font-size:10px;fill:#202124;">localhost:8765</text>

    <text x="12" y="195" class="box-text">Server loopback</text>
    <text x="12" y="213" class="box-text">tự bắt code.</text>
    <text x="12" y="231" class="box-text">Đổi token tự động.</text>
    <text x="12" y="255" style="font-family:sans-serif;font-size:10.5px;font-weight:bold;fill:#137333;">Người dùng đóng</text>
    <text x="12" y="273" style="font-family:sans-serif;font-size:10.5px;font-weight:bold;fill:#137333;">tab trình duyệt.</text>
  </g>
</svg>
"""
    p = EVIDENCE_DIR / "consent_flow_diagram.svg"
    p.write_text(svg, encoding="utf-8")
    print(f"Created: {p}")

def make_console_setup_svg():
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 520" width="100%" height="100%">
  <defs>
    <style>
      .title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: bold; font-size: 20px; fill: #202124; }
      .desc { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; fill: #5f6368; }
      .card-title { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: 600; font-size: 14px; fill: #1a73e8; }
      .card-body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11.5px; fill: #3c4043; }
      .num { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-weight: bold; font-size: 11px; fill: #ffffff; }
      .code { font-family: "Cascadia Code", Consolas, monospace; font-size: 11px; fill: #d93025; background: #fce8e6; }
    </style>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000000" flood-opacity="0.08"/>
    </filter>
  </defs>

  <rect width="1000" height="520" fill="#f8f9fa" rx="12"/>

  <text x="40" y="45" class="title">CÁC BƯỚC THIẾT LẬP GOOGLE CLOUD CONSOLE (BYO OAUTH CLIENT)</text>
  <text x="40" y="70" class="desc">Hướng dẫn chuẩn cho FR-CF-11 — Tạo dự án, bật API, cấu hình màn hình đồng ý, test user và tải client JSON</text>

  <!-- Hàng 1: Bước 1, 2, 3 -->
  <!-- Bước 1 -->
  <g transform="translate(40, 95)" filter="url(#shadow)">
    <rect width="280" height="180" rx="8" fill="#ffffff" stroke="#dadce0"/>
    <circle cx="24" cy="24" r="12" fill="#1a73e8"/>
    <text x="21" y="28" class="num">1</text>
    <text x="45" y="28" class="card-title">Tạo Google Cloud Project</text>
    <line x1="15" y1="45" x2="265" y2="45" stroke="#f1f3f4"/>
    
    <text x="18" y="70" class="card-body">1. Truy cập: console.cloud.google.com</text>
    <text x="18" y="92" class="card-body">2. Bấm dropdown chọn dự án ở top bar</text>
    <text x="18" y="114" class="card-body">3. Bấm "New Project"</text>
    <text x="18" y="136" class="card-body">4. Tên dự án: "Desktop Assistant"</text>
    <text x="18" y="158" class="card-body">5. Bấm "Create" và đợi hoàn tất</text>
  </g>

  <!-- Bước 2 -->
  <g transform="translate(360, 95)" filter="url(#shadow)">
    <rect width="280" height="180" rx="8" fill="#ffffff" stroke="#dadce0"/>
    <circle cx="24" cy="24" r="12" fill="#1a73e8"/>
    <text x="21" y="28" class="num">2</text>
    <text x="45" y="28" class="card-title">Bật Gmail &amp; Drive APIs</text>
    <line x1="15" y1="45" x2="265" y2="45" stroke="#f1f3f4"/>
    
    <text x="18" y="70" class="card-body">1. Menu: APIs &amp; Services ➔ Library</text>
    <text x="18" y="92" class="card-body">2. Tìm "Gmail API" ➔ Bấm Enable</text>
    <text x="18" y="114" class="card-body">3. Tìm "Google Drive API" ➔ Bấm Enable</text>
    <text x="18" y="145" class="card-body" style="fill:#137333;font-weight:bold;">✓ Cả 2 API bắt buộc phải bật để app</text>
    <text x="18" y="163" class="card-body" style="fill:#137333;font-weight:bold;">  đọc được thư và tìm kiếm tài liệu.</text>
  </g>

  <!-- Bước 3 -->
  <g transform="translate(680, 95)" filter="url(#shadow)">
    <rect width="280" height="180" rx="8" fill="#ffffff" stroke="#dadce0"/>
    <circle cx="24" cy="24" r="12" fill="#1a73e8"/>
    <text x="21" y="28" class="num">3</text>
    <text x="45" y="28" class="card-title">OAuth Consent Screen</text>
    <line x1="15" y1="45" x2="265" y2="45" stroke="#f1f3f4"/>
    
    <text x="18" y="70" class="card-body">1. Menu: APIs &amp; Services ➔ Consent screen</text>
    <text x="18" y="92" class="card-body">2. User Type: External (hoặc Internal nếu</text>
    <text x="18" y="108" class="card-body">   có Google Workspace tổ chức)</text>
    <text x="18" y="130" class="card-body">3. App name: "Desktop Assistant"</text>
    <text x="18" y="152" class="card-body">4. User support &amp; developer email: nhập</text>
    <text x="18" y="168" class="card-body">   email của bạn ➔ Save and Continue</text>
  </g>

  <!-- Hàng 2: Bước 4, 5, 6 -->
  <!-- Bước 4 -->
  <g transform="translate(40, 305)" filter="url(#shadow)">
    <rect width="280" height="180" rx="8" fill="#ffffff" stroke="#dadce0"/>
    <circle cx="24" cy="24" r="12" fill="#1a73e8"/>
    <text x="21" y="28" class="num">4</text>
    <text x="45" y="28" class="card-title">Khai Scopes &amp; Test Users</text>
    <line x1="15" y1="45" x2="265" y2="45" stroke="#f1f3f4"/>
    
    <text x="18" y="68" class="card-body">1. Mục Scopes: bấm Add or Remove Scopes</text>
    <text x="18" y="86" class="card-body">   Tích chọn gmail.readonly và drive.readonly</text>
    <text x="18" y="112" class="card-body">2. Mục Test users (BẮT BUỘC):</text>
    <text x="18" y="130" class="card-body">   Bấm "+ Add Users"</text>
    <text x="18" y="148" class="card-body">   Nhập chính xác email của bạn</text>
    <text x="18" y="168" class="card-body" style="fill:#d93025;font-weight:bold;">⚠️ Thiếu bước này sẽ gặp lỗi 403 access_denied</text>
  </g>

  <!-- Bước 5 -->
  <g transform="translate(360, 305)" filter="url(#shadow)">
    <rect width="280" height="180" rx="8" fill="#ffffff" stroke="#dadce0"/>
    <circle cx="24" cy="24" r="12" fill="#1a73e8"/>
    <text x="21" y="28" class="num">5</text>
    <text x="45" y="28" class="card-title">Tạo OAuth Client ID</text>
    <line x1="15" y1="45" x2="265" y2="45" stroke="#f1f3f4"/>
    
    <text x="18" y="68" class="card-body">1. Menu: APIs &amp; Services ➔ Credentials</text>
    <text x="18" y="90" class="card-body">2. Bấm "+ Create Credentials"</text>
    <text x="18" y="110" class="card-body">3. Chọn "OAuth client ID"</text>
    <text x="18" y="132" class="card-body">4. Application type: BẮT BUỘC chọn</text>
    <text x="18" y="150" class="card-body" style="fill:#d93025;font-weight:bold;">   "Desktop app" (KHÔNG chọn Web!)</text>
    <text x="18" y="168" class="card-body">5. Name: "Desktop Assistant Client"</text>
  </g>

  <!-- Bước 6 -->
  <g transform="translate(680, 305)" filter="url(#shadow)">
    <rect width="280" height="180" rx="8" fill="#e8f0fe" stroke="#1a73e8" stroke-width="1.5"/>
    <circle cx="24" cy="24" r="12" fill="#1a73e8"/>
    <text x="21" y="28" class="num">6</text>
    <text x="45" y="28" class="card-title">Tải JSON &amp; Nạp vào App</text>
    <line x1="15" y1="45" x2="265" y2="45" stroke="#d2e3fc"/>
    
    <text x="18" y="68" class="card-body">1. Bấm nút Download ⬇️ (Download JSON)</text>
    <text x="18" y="90" class="card-body">2. Mở Desktop Assistant ➔ Settings</text>
    <text x="18" y="108" class="card-body">3. Chọn Connectors ➔ Google ➔ BYO Client</text>
    <text x="18" y="130" class="card-body">4. Nạp file JSON vừa tải về</text>
    <text x="18" y="152" class="card-body" style="fill:#137333;font-weight:bold;">5. Bấm Connect ➔ App tự mở trình duyệt</text>
    <text x="18" y="168" class="card-body" style="fill:#137333;font-weight:bold;">   và hoàn tất cấp quyền qua loopback!</text>
  </g>
</svg>
"""
    p = EVIDENCE_DIR / "console_setup_diagram.svg"
    p.write_text(svg, encoding="utf-8")
    print(f"Created: {p}")

def make_ui_unverified_warning_svg():
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 540" width="100%" height="100%">
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="600" height="540" fill="#f1f3f4"/>
  <rect x="75" y="30" width="450" height="480" rx="12" fill="#ffffff" filter="url(#shadow)"/>
  
  <!-- Header Google -->
  <circle cx="115" cy="65" r="12" fill="#ea4335"/>
  <text x="135" y="70" style="font-family:sans-serif;font-size:16px;font-weight:bold;fill:#5f6368;">Sign in with Google</text>

  <!-- Warning Icon -->
  <path d="M 115 115 L 132 145 L 98 145 Z" fill="#d93025"/>
  <text x="113" y="141" style="font-family:sans-serif;font-size:16px;font-weight:bold;fill:#ffffff;">!</text>
  
  <text x="145" y="138" style="font-family:sans-serif;font-size:22px;font-weight:500;fill:#202124;">Google hasn't verified this app</text>
  
  <text x="100" y="180" style="font-family:sans-serif;font-size:13px;fill:#3c4043;line-height:1.5;">
    The app is requesting access to sensitive info in your Google Account.
  </text>
  <text x="100" y="200" style="font-family:sans-serif;font-size:13px;fill:#3c4043;">
    Until the developer verifies this app, you shouldn't use it.
  </text>

  <!-- Primary Button: Back to safety -->
  <rect x="360" y="240" width="130" height="38" rx="6" fill="#1a73e8"/>
  <text x="382" y="264" style="font-family:sans-serif;font-size:13px;font-weight:bold;fill:#ffffff;">Back to safety</text>

  <!-- Link: Advanced -->
  <text x="100" y="264" style="font-family:sans-serif;font-size:14px;font-weight:bold;fill:#1a73e8;cursor:pointer;">Advanced</text>
  <rect x="95" y="248" width="80" height="26" fill="none" stroke="#d93025" stroke-width="1.5" stroke-dasharray="3,3"/>
  <text x="100" y="295" style="font-family:sans-serif;font-size:11px;font-weight:bold;fill:#d93025;">← Bước 1: Click Advanced ở đây</text>

  <!-- Expanded section -->
  <rect x="100" y="320" width="390" height="150" rx="8" fill="#f8f9fa" stroke="#e8eaed"/>
  <text x="115" y="348" style="font-family:sans-serif;font-size:12px;fill:#5f6368;">If you understand the risks to your security, you may continue</text>
  <text x="115" y="366" style="font-family:sans-serif;font-size:12px;fill:#5f6368;">to the app at your own risk.</text>
  
  <!-- Link: Go to Desktop Assistant (unsafe) -->
  <text x="115" y="410" style="font-family:sans-serif;font-size:13px;font-weight:bold;fill:#1a73e8;text-decoration:underline;cursor:pointer;">Go to Desktop Assistant (unsafe)</text>
  <rect x="110" y="394" width="220" height="24" fill="none" stroke="#d93025" stroke-width="1.5" stroke-dasharray="3,3"/>
  <text x="115" y="445" style="font-family:sans-serif;font-size:11px;font-weight:bold;fill:#d93025;">← Bước 2: Click "Go to ... (unsafe)" để tiếp tục</text>
</svg>
"""
    p = EVIDENCE_DIR / "ui_unverified_warning.svg"
    p.write_text(svg, encoding="utf-8")
    print(f"Created: {p}")

def make_ui_scope_consent_svg():
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 560" width="100%" height="100%">
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="600" height="560" fill="#f1f3f4"/>
  <rect x="75" y="30" width="450" height="500" rx="12" fill="#ffffff" filter="url(#shadow)"/>

  <!-- App Header -->
  <circle cx="120" cy="70" r="18" fill="#1a73e8"/>
  <text x="113" y="77" style="font-family:sans-serif;font-size:18px;font-weight:bold;fill:#ffffff;">D</text>
  <text x="150" y="68" style="font-family:sans-serif;font-size:18px;font-weight:bold;fill:#202124;">Desktop Assistant</text>
  <text x="150" y="85" style="font-family:sans-serif;font-size:12px;fill:#5f6368;">wants access to your Google Account</text>

  <!-- User Card -->
  <rect x="100" y="110" width="400" height="40" rx="6" fill="#f8f9fa" stroke="#dadce0"/>
  <circle cx="120" cy="130" r="10" fill="#e8710a"/>
  <text x="140" y="135" style="font-family:sans-serif;font-size:12px;fill:#202124;font-weight:500;">owner@example.com</text>

  <text x="100" y="180" style="font-family:sans-serif;font-size:13px;font-weight:bold;fill:#202124;">Select what Desktop Assistant can access:</text>

  <!-- Scope 1: Gmail -->
  <rect x="100" y="200" width="400" height="70" rx="8" fill="#f8f9fa" stroke="#dadce0"/>
  <rect x="115" y="215" width="18" height="18" rx="3" fill="#1a73e8"/>
  <text x="119" y="229" style="font-family:sans-serif;font-size:14px;fill:#ffffff;">✓</text>
  <text x="145" y="228" style="font-family:sans-serif;font-size:13px;font-weight:600;fill:#202124;">View your email messages and settings</text>
  <text x="145" y="248" style="font-family:sans-serif;font-size:11.5px;fill:#5f6368;">Read messages and metadata (gmail.readonly)</text>

  <!-- Scope 2: Drive -->
  <rect x="100" y="285" width="400" height="70" rx="8" fill="#f8f9fa" stroke="#dadce0"/>
  <rect x="115" y="300" width="18" height="18" rx="3" fill="#1a73e8"/>
  <text x="119" y="314" style="font-family:sans-serif;font-size:14px;fill:#ffffff;">✓</text>
  <text x="145" y="313" style="font-family:sans-serif;font-size:13px;font-weight:600;fill:#202124;">See and download all your Google Drive files</text>
  <text x="145" y="333" style="font-family:sans-serif;font-size:11.5px;fill:#5f6368;">Read docs, sheets, PDFs, and images (drive.readonly)</text>

  <!-- Warning Box -->
  <rect x="100" y="370" width="400" height="60" rx="6" fill="#fef7e0" stroke="#f9ab00"/>
  <text x="115" y="392" style="font-family:sans-serif;font-size:11.5px;font-weight:bold;fill:#b06000;">⚠️ Lưu ý quan trọng:</text>
  <text x="115" y="412" style="font-family:sans-serif;font-size:11.5px;fill:#3c4043;">Bắt buộc phải tích chọn CẢ HAI ô để connector hoạt động đầy đủ.</text>

  <!-- Action Buttons -->
  <rect x="290" y="455" width="100" height="38" rx="6" fill="#f1f3f4"/>
  <text x="320" y="479" style="font-family:sans-serif;font-size:13px;font-weight:500;fill:#1a73e8;">Cancel</text>
  
  <rect x="400" y="455" width="100" height="38" rx="6" fill="#1a73e8"/>
  <text x="425" y="479" style="font-family:sans-serif;font-size:13px;font-weight:bold;fill:#ffffff;">Continue</text>
  <text x="405" y="515" style="font-family:sans-serif;font-size:11px;font-weight:bold;fill:#d93025;">← Bước 3: Bấm Continue</text>
</svg>
"""
    p = EVIDENCE_DIR / "ui_scope_consent.svg"
    p.write_text(svg, encoding="utf-8")
    print(f"Created: {p}")

if __name__ == "__main__":
    make_consent_flow_svg()
    make_console_setup_svg()
    make_ui_unverified_warning_svg()
    make_ui_scope_consent_svg()
