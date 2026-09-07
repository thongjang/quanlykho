# Mô tả hệ thống Quản lý tồn kho (Google Sheet + Apps Script + HTML app)

Tài liệu này mô tả đầy đủ cấu trúc dữ liệu, quy tắc nghiệp vụ, và logic tính toán của hệ thống quản lý tồn kho hiện tại (đang chạy trên Google Sheets + Apps Script). Dùng tài liệu này làm ngữ cảnh khi tiếp tục phát triển app `index.html` (web app di động chạy độc lập, đồng bộ 2 chiều với Google Sheet qua Sheets API) để đảm bảo app khớp đúng cấu trúc và quy tắc của Sheet thật.

## 1. Mục tiêu hệ thống

Theo dõi tồn kho vật tư/bao bì thực tế, tách biệt:
- **Tồn ERP**: số lượng đã được hệ thống ERP của công ty ghi nhận/cấn trừ chính thức.
- **Tồn mượn (chưa cấn trừ)**: số lượng đã xuất kho vật lý cho sản xuất nhưng ERP chưa cấn trừ (vì thành phẩm chưa hoàn tất).
- **Tồn thực tế**: số lượng thật sự có trong kho tại một thời điểm = `Tồn ERP − Tồn mượn`.

Mỗi vật tư còn được theo dõi theo **Location** (kho vật lý / lý do phát sinh):
- `DF` — kho chính, nơi diễn ra toàn bộ hoạt động Nhập mua hàng và Xuất sản xuất bình thường.
- `RETURN` — hàng lỗi trả lại nhà cung cấp (luôn là Xuất, cấn trừ ERP ngay lập tức, không có khái niệm Mượn).
- `Tra NCC` — chênh lệch phát hiện khi kiểm đếm hàng nhận về so với chứng từ (ví dụ: chứng từ ghi nhập 1000 nhưng kiểm đếm thực tế chỉ có 950 → lập 1 dòng Xuất "Tra NCC" 50 để giải thích khoản chênh lệch). Cũng luôn dùng Nguồn = ERP.

## 2. Cấu trúc Google Sheet (5 sheet)

### 2.1 Sheet "Danh mục SP"
Danh mục vật tư/sản phẩm. Header ở dòng 3, dữ liệu bắt đầu dòng 4. Hỗ trợ tối đa 500 dòng sản phẩm (dòng 4–503).

| Cột | Tên | Ghi chú |
|---|---|---|
| A | Mã SP | Mã số, kiểu số nguyên |
| B | Tên SP | Text |
| C | ĐVT | Đơn vị tính |
| D | Ngưỡng cảnh báo tồn thấp | Số — nếu Tồn thực tế ≤ ngưỡng này thì Trạng thái = "Thấp" |
| E | Link hình ảnh | Tùy chọn, có thể để trống |

*(Lưu ý: sheet này KHÔNG có cột "Diễn giải" — đã bị bỏ theo yêu cầu trước đó.)*

### 2.2 Sheet "Giao dịch"
Sổ giao dịch — mỗi dòng là 1 sự kiện Nhập/Xuất thật. Header dòng 3, dữ liệu từ dòng 4. Hỗ trợ tới 3000 dòng.

| Cột | Tên | Ghi chú |
|---|---|---|
| A | Ngày chứng từ | Kiểu Date |
| B | Mã SP | Tham chiếu tới Danh mục SP cột A |
| C | Tên SP | **CÔNG THỨC** `=IF($B{row}="","",IFERROR(VLOOKUP($B{row},'Danh mục SP'!$A$4:$B$503,2,FALSE),""))` — đã được điền sẵn cho toàn bộ 3000 dòng. **KHÔNG BAO GIỜ ghi giá trị tĩnh vào cột này** — mọi thao tác ghi (script, app, thủ công) phải bỏ qua cột C hoàn toàn để không phá công thức. |
| D | Loại | Chỉ 2 giá trị: `"Nhập"` hoặc `"Xuất"` (có dấu, chữ Việt) |
| E | Nguồn | Chỉ 2 giá trị: `"ERP"` hoặc `"Mượn"` |
| F | Location | Chỉ 3 giá trị: `"DF"`, `"RETURN"`, `"Tra NCC"` |
| G | Số lượng | Số dương |
| H | Ghi chú | Text tự do |
| I | Ngày nhập liệu | Ngày thực tế nhập liệu vào hệ thống (khác Ngày chứng từ) |

Quy tắc dữ liệu: `Nguồn = "Mượn"` chỉ xuất hiện khi `Location = "DF"` (khái niệm Mượn chỉ tồn tại ở kho chính). Ở `RETURN` và `Tra NCC`, Nguồn luôn là `"ERP"`.

### 2.3 Sheet "Tồn kho hiện tại"
Báo cáo tồn kho tức thời — do Apps Script ghi đè hoàn toàn mỗi lần chạy (không phải công thức, không sửa tay). Header dòng 3, dữ liệu từ dòng 4. Mỗi Mã SP có đúng 3 dòng (1 dòng / Location).

| Cột | Tên |
|---|---|
| A | Mã SP |
| B | Location |
| C | Tên SP |
| D | ĐVT |
| E | Tồn ERP |
| F | Tồn mượn (**số dương** = đang treo chưa cấn trừ) |
| G | Tồn thực tế = `E − F` |
| H | Trạng thái ("Thấp" / "Đủ") |

### 2.4 Sheet "Báo cáo tháng ERP"
Báo cáo theo tháng, chỉ tính giao dịch Nguồn = ERP. Ô B3 = ngày đầu tháng cần xem (hiển thị dạng `MM-yyyy`, ví dụ `09-2026`). Header dòng 5, dữ liệu từ dòng 6. 1 dòng / Mã SP (không tách theo Location).

| Cột | Tên | Công thức ý nghĩa |
|---|---|---|
| A | Mã SP | |
| B | Tên SP | |
| C | ĐVT | |
| D | Tồn đầu kỳ | Cộng dồn Nhập−Xuất (Nguồn=ERP, **gộp cả 3 Location**) của MỌI giao dịch có Ngày chứng từ **trước** ngày đầu tháng đang chọn. Không lưu trữ riêng — tính trực tiếp từ Giao dịch mỗi lần chạy. |
| E | Nhập trong kỳ | Tổng Nhập, Location=DF, Nguồn=ERP, trong tháng (mua hàng từ NCC) |
| F | Xuất sản xuất | Tổng Xuất, Location=DF, Nguồn=ERP, trong tháng (xuất cho SX đã hoàn thành 100%, cấn trừ chính thức) |
| G | Xuất trả return | Tổng Xuất, Location=RETURN, trong tháng |
| H | Xuất trả NCC | Tổng Xuất, Location=Tra NCC, trong tháng |
| I | Tồn cuối | `D + E − F − G − H` |

**Tồn đầu kỳ của tháng sau luôn tự động bằng đúng Tồn cuối của tháng trước** — vì cả hai đều tính từ cùng 1 nguồn dữ liệu (Giao dịch) theo mốc ngày, không có bước "chuyển số dư" thủ công nào.

### 2.5 Sheet "Báo cáo tháng Mượn"
Giống cấu trúc trên nhưng chỉ tính Nguồn = Mượn (chỉ có ở Location=DF). Ô B3 riêng, độc lập với sheet ERP. Header dòng 5, dữ liệu từ dòng 6.

| Cột | Tên | Ý nghĩa |
|---|---|---|
| A | Mã SP | |
| B | Tên SP | |
| C | ĐVT | |
| D | Tồn đầu kỳ | Số dương, cộng dồn (Xuất−Nhập, Nguồn=Mượn, Location=DF) trước ngày đầu tháng |
| E | Xuất mượn từ ERP | Tổng Xuất-Mượn trong tháng (đang trong quá trình sản xuất, chưa thành phẩm) |
| F | Nhập trả lại | Tổng Nhập-Mượn trong tháng (đã thành phẩm, đóng khoản mượn) |
| G | Tồn cuối kỳ | `D + E − F`, số dương = còn đang treo |

## 3. Apps Script (đã cài trong Sheet, 3 file)

- **Code.gs**: chỉ có `onOpen()` — tạo menu "Quan ly ton kho" với 4 mục: Them giao dich, Cap nhat bao cao, Ve thang hien tai, Kiem tra ton thap va gui email.
- **FormNhapLieu.gs**: `showForm()`, `getProductCodes()`, `timDongTrongTiepTheo()`, `addTransaction(form)` — xử lý form nhập liệu nhanh (dialog HTML `Form.html`), ghi từng ô riêng lẻ vào Giao dịch, **bỏ qua cột C**.
- **BaoCao.gs**: toàn bộ logic tính toán — `docDanhMucSP()`, `docGiaoDich()`, `tonTruocNgay()`, `tongTrongKy()`, `ghiBaoCaoThangERP()`, `ghiBaoCaoThangMuon()`, `capNhatBaoCao()` (hàm chính, ghi lại cả 3 báo cáo), `veThangHienTai()` (đặt B3 về tháng hiện tại), `checkLowStock()` (gửi email cảnh báo).

Hàm cốt lõi cần nắm để tái tạo logic ở app khác:

```javascript
// Cong don Nhap-Xuat (net) cho MOI giao dich TRUOC ngay cutoffExclusive.
// loc=null nghia la khong loc theo Location (gop ca 3).
function tonTruocNgay(txs, code, loc, nguon, cutoffExclusive) {
  let nhap = 0, xuat = 0;
  txs.forEach(t => {
    if (t.code !== code || t.nguon !== nguon) return;
    if (loc !== null && t.loc !== loc) return;
    if (t.date >= cutoffExclusive) return;
    if (t.loai === 'Nhập') nhap += t.qty; else xuat += t.qty;
  });
  return nhap - xuat;
}
```

Tồn ERP tại 1 thời điểm = `tonTruocNgay(txs, code, loc, 'ERP', ngayRatXa)`.
Tồn mượn (dương) = `-tonTruocNgay(txs, code, loc, 'Mượn', ngayRatXa)`.
Tồn thực tế = `Tồn ERP - Tồn mượn`.

## 4. App HTML di động (`index.html`) — trạng thái hiện tại

File độc lập, chạy trên điện thoại/máy tính. **Bắt buộc dùng khi có mạng** — không còn chế độ offline: Service Worker/cache PWA cũ đã bị gỡ (`sw.js` đã xóa), khi mất kết nối app hiện lớp phủ khóa toàn bộ thao tác (`#offline-gate`) cho tới khi có mạng lại. `manifest.json` giữ lại chỉ để cài như app (installable), không phục vụ offline. Lưu dữ liệu tạm bằng `localStorage` (key `inv_mobile_data_v2`) như bộ nhớ đệm phiên làm việc, đồng bộ 2 chiều với Google Sheet qua Sheets API (OAuth Client ID + Spreadsheet ID do người dùng tự nhập trong tab "Google Sheet" của app).

Giao diện có **layout desktop** riêng (`@media (min-width: 900px)`): thanh điều hướng chuyển thành sidebar bên trái, vùng nội dung giới hạn bề rộng và căn giữa, tab Giao dịch chia 2 cột (form trái — lịch sử phải).

**Mô hình dữ liệu trong app (đã khớp với Sheet thật):**
```js
product = { id, code, name, unit, threshold, image /* Link hình ảnh, cột E Danh mục SP */ }
transaction = { id, date, productId, type /* 'Nhập'|'Xuất' */, source /* 'ERP'|'Mượn' */,
                 location /* 'DF'|'RETURN'|'Tra NCC' */, qty, note, synced }
```

**Đã hoàn thiện:**
- 4 tab: Sản phẩm, Giao dịch (form thêm giao dịch có đủ Location), Báo cáo, Google Sheet (kết nối/đồng bộ).
- Tab **Sản phẩm** có bộ lọc + tìm kiếm (`productFilter`, lưu ở key `inv_product_filter_v1`): tìm theo Mã/Tên, lọc theo Trạng thái (Thấp/Đủ), lọc theo Location (gộp cả 3 hoặc chỉ 1 — số tồn hiển thị đổi theo Location đang chọn), sắp xếp theo Mã/Tên/Tồn thực tế tăng-giảm. Ô tìm kiếm không mất focus khi gõ vì chỉ vẽ lại `#product-list`.
- Tab **Báo cáo** có 3 chế độ (`reportView`, key `inv_report_view_v1`): "Tồn hiện tại" (snapshot cũ), "Tháng ERP", "Tháng Mượn".
  - `netTruocNgay(productId, loc, source, cutoff)` — bản JS của `tonTruocNgay()` bên Apps Script (cộng dồn Nhập−Xuất mọi giao dịch có ngày `< cutoff`).
  - `reportRowERP()` đúng mục 2.4: Tồn đầu kỳ = `netTruocNgay(id, null, 'ERP', ngày-01)` (gộp cả 3 Location); Nhập trong kỳ / Xuất sản xuất = DF+ERP trong tháng; Xuất trả return = Location RETURN; Xuất trả NCC = Location "Tra NCC"; Tồn cuối = D+E−F−G−H.
  - `reportRowMuon()` đúng mục 2.5: chỉ Nguồn=Mượn & Location=DF; Tồn đầu kỳ (số dương) = `−netTruocNgay(id, 'DF', 'Mượn', ngày-01)`; Tồn cuối kỳ = D + Xuất mượn − Nhập trả lại.
  - Chọn tháng bằng `<input type="month">`, có checkbox "Ẩn dòng toàn số 0", bảng có dòng TỔNG.
- `computeStock(productId, loc)` — tính đúng quy ước dấu mới (Tồn mượn dương, Tồn thực tế = ERP − Mượn), `loc=null` để cộng dồn cả 3 Location.
- Nhập/Xuất Excel: nhận diện đúng tên sheet có dấu ("Danh mục SP", "Giao dịch"), đúng số cột, có Location + cột E "Link hình ảnh" của Danh mục SP.
- Đồng bộ lên Sheet (`pushToSheet`): tách ghi 2 vùng (A:B rồi D:I), không đụng cột C, tự tìm dòng trống dựa theo cột B — logic giống hệt `timDongTrongTiepTheo()` bên Apps Script.
- Đồng bộ tải về (`pullFromSheet`): đọc `Danh mục SP!A4:E500` và `Giao dịch!A4:I3000`, khử trùng lặp bằng key ghép (ngày+mã+loại+nguồn+location+SL+ghi chú).

**Còn thiếu / có thể cần làm tiếp (gợi ý cho Claude Code):**
1. Chưa có cơ chế xử lý xoá/sửa giao dịch đã đồng bộ (hiện chỉ có thêm mới).
2. Chưa validate ràng buộc "Nguồn=Mượn chỉ hợp lệ khi Location=DF" ở phía giao diện (Sheet cũng chưa ép buộc, chỉ là quy ước).
3. Form thêm giao dịch chưa có phím tắt chọn nhanh Location theo Loại (ví dụ chọn Loại=Xuất thì gợi ý Location=RETURN hoặc Tra NCC ở đầu danh sách).
4. Đồng bộ hiện chạy tuần tự từng giao dịch một (2 lệnh gọi API/giao dịch) — có thể chậm nếu nhiều giao dịch chờ đồng bộ cùng lúc; có thể cân nhắc gộp bằng `batchUpdate` nếu cần tối ưu tốc độ.
5. Báo cáo tháng bên app tính lại từ toàn bộ `state.transactions` mỗi lần render — nếu dữ liệu lớn (hàng nghìn giao dịch) có thể cân nhắc cache theo tháng.

## 5. Ràng buộc / lưu ý quan trọng khi sửa code

- **Không bao giờ ghi giá trị tĩnh vào cột C (Tên SP) của sheet Giao dịch** — dù từ Apps Script hay từ app qua Sheets API — vì đây là công thức đã điền sẵn cho 3000 dòng.
- Giá trị Loại/Nguồn phải đúng chính tả có dấu: `"Nhập"`, `"Xuất"`, `"ERP"`, `"Mượn"` — không dùng bản không dấu (`"Nhap"`, `"Xuat"`, `"Muon"`) vì sẽ không khớp với dữ liệu/công thức đang có.
- Tên 3 Location cố định: `"DF"`, `"RETURN"`, `"Tra NCC"` (chú ý khoảng trắng và chữ hoa/thường trong `"Tra NCC"`).
- Ô B3 ở 2 sheet báo cáo tháng lưu giá trị Date thật (ngày 01 hoặc 15 của tháng), chỉ **hiển thị** dạng `MM-yyyy` — khi đọc bằng code phải dùng `getValue()`/giá trị Date gốc, không parse chuỗi hiển thị.
