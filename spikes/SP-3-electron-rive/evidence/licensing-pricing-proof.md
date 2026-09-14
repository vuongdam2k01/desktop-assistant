# Bằng Chứng Khảo Sát Giấy Phép & Bảng Giá Rive (Q5)

| Thuộc tính | Chi tiết |
| :--- | :--- |
| **Ngày khảo sát** | 12/09/2026 |
| **Nguồn Runtime** | `https://github.com/rive-app/rive-wasm/blob/master/LICENSE` |
| **Nguồn Giá Editor** | `https://rive.app/pricing` (Trang giá chính thức công bố của Rive) |

---

## 1. Giấy phép Runtime (Thư viện chạy trong ứng dụng)

- **Gói Runtime sử dụng**: `@rive-app/canvas` v2.42.1 (kèm `rive.wasm`).
- **Giấy phép bản quyền**: **MIT License** (mã nguồn mở hoàn toàn).
- **Trích dẫn điều khoản**:
  > *"Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software..."*
- **Quyền sử dụng thương mại**:
  - **TỰ DO THƯƠNG MẠI 100%**: Được phép tích hợp, phân phối, thương mại hóa trong sản phẩm desktop thương mại mà **không phải trả bất kỳ khoản phí royalty, phí bản quyền runtime, hay phí phân phối nào**.
  - Không giới hạn số lượng người dùng cuối, không ràng buộc số lượng bản cài đặt Electron.

---

## 2. Giấy phép & Chi phí Công cụ Thiết kế (Rive Editor & Hosting)

Rive Editor là dịch vụ SaaS độc quyền dựa trên nền tảng web. Chi phí áp dụng cho nhân sự thiết kế (Designers) sử dụng Editor để tạo và xuất file:

| Gói cước (Plan) | Giá công bố (Niêm yết) | Giới hạn chỗ (Seats) | Quyền xuất file `.riv` cho App? | Tính năng chính |
| :--- | :---: | :---: | :---: | :--- |
| **Free** | **$0** /seat/tháng | Không giới hạn | ❌ **KHÔNG** (Chỉ học và làm thử trong editor) | 3 collaborative files, 10 personal files, Agent có giới hạn. |
| **Cadet** | **$9** /seat/tháng | Tối đa 3 seats | ✅ **CÓ (Xuất `.riv` không giới hạn)** | Unlimited files, **Export `.riv` files**, ship to apps, products, vehicles, games. |
| **Voyager** | **$32** /seat/tháng | Tối đa 25 seats | ✅ **CÓ** | Dùng chung Shared Team Libraries, Embed URL hosting, Agent advanced models, $20 credit Agent/seat/tháng. |
| **Enterprise** | **$120** /seat/tháng | Cho cty doanh thu >$10M | ✅ **CÓ** | Subteam workspaces, Custom S3 bucket, Custom runtime, Slack channel riêng với team Rive, SSO, SOC2 Type II. |

---

## 3. Kết luận & Nghĩa vụ chi phí của Team

1. **Phía Client / Developer / Người dùng cuối**: **$0** (Không mất bất kỳ chi phí nào nhờ giấy phép runtime MIT).
2. **Phía Designer / Đội ngũ sáng tạo**:
   - Gói Free **không thể dùng cho sản phẩm thật** vì Rive chặn tính năng xuất (Export) file binary `.riv` ở gói Free.
   - Bắt buộc designer phải đăng ký tối thiểu **gói Cadet ($9/người/tháng)** để xuất file `.riv`.
   - Với quy mô MVP (1 designer): chi phí chỉ là **$9/tháng** (~220.000 VNĐ/tháng). Nếu cần dùng thư viện chia sẻ tài nguyên nhóm (Team Libraries) khi team có 2+ designer, nâng lên **Voyager ($32/người/tháng)**.
3. **Dịch vụ Hosting**: Không bắt buộc phải mua gói hosting của Rive, vì tệp `.riv` được đóng gói trực tiếp cục bộ trong ứng dụng Electron hoặc lưu trữ trên S3/CDN riêng của dự án.
