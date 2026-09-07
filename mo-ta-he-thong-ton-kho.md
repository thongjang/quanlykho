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

File độc lập, chạy trên điện thoại/máy tính. **Bắt buộc dùng khi có mạng** — không còn chế độ offline: Service Worker/cache PWA cũ bị gỡ (`sw.js` chỉ còn bản "tự huỷ" để dọn máy đã cài PWA cũ), khi mất kết nối app hiện lớp phủ khóa toàn bộ thao tác (`#offline-gate`) cho tới khi có mạng lại. `manifest.json` giữ lại chỉ để cài như app (installable).

**Truy vấn trực tiếp Google Sheet** — Sheet là nguồn dữ liệu **duy nhất**:
- Không còn Nhập Excel / Xuất Excel, không còn bước "Đồng bộ" thủ công (đã bỏ `xlsx` CDN, `synced`, `localStorage` cho dữ liệu).
- `state` chỉ là bản sao trong bộ nhớ; `localStorage` chỉ giữ cấu hình (`inv_google_cfg_v2`) và tuỳ chọn giao diện (`inv_product_filter_v1`, `inv_report_view_v1`).
- Đăng nhập Google xong → `loadFromSheet()` tự chạy: đọc `Danh mục SP!A4:E503` + `Giao dịch!A4:I3000`, dựng lại toàn bộ `state`. Nút "↻ Tải lại" ở header / tab Google / cuối báo cáo để nạp lại. Mở lại app có sẵn cấu hình thì tự xin token (`prompt:''`) và tải ngay.
- Thêm sản phẩm → `addProductRowToSheet()` ghi 1 dòng `Danh mục SP!A:E` vào dòng trống đầu tiên (theo cột A).
- Thêm giao dịch → `addTransactionRowToSheet()` ghi `A:B` rồi `D:I` (BỎ QUA cột C – công thức Tên SP), dò dòng trống theo cột B, cột I = ngày nhập liệu hôm nay.
- `id` ổn định theo Sheet: sản phẩm `p_<mã>`, giao dịch `g_<số dòng>`; mỗi bản ghi giữ `_row` (số dòng trên Sheet).
- `sheetsGet/sheetsUpdate` gặp HTTP 401 → xoá token, hiện lại màn hình đăng nhập.

Giao diện:
- **Layout desktop** (`@media (min-width: 900px)`): điều hướng thành sidebar trái, nội dung giới hạn bề rộng & căn giữa, tab Giao dịch chia 2 cột.
- **Không có scroll ngang ở bất kỳ màn hình nào**: `html,body{overflow-x:hidden}`; bảng báo cáo rộng chỉ hiện ở desktop, còn mobile render dạng **thẻ** (`.rpt-cards` — mỗi SP 1 thẻ, lưới nhãn/giá trị 2 cột).

**Mô hình dữ liệu trong app:**
```js
product = { id:'p_<mã>', _row, code, name, unit, threshold, image /* cột E Danh mục SP */ }
transaction = { id:'g_<dòng>', _row, date, productId, type /* 'Nhập'|'Xuất' */,
                source /* 'ERP'|'Mượn' */, location /* 'DF'|'RETURN'|'Tra NCC' */, qty, note }
```

**Đã hoàn thiện:**
- 4 tab: Sản phẩm, Giao dịch, Báo cáo, Google Sheet. Khi chưa đăng nhập, mọi tab (trừ Google Sheet) hiện lời nhắc sang tab Google Sheet.
- Tab **Sản phẩm** — bộ lọc + tìm kiếm (`productFilter`): tìm theo Mã/Tên, lọc Trạng thái (Thấp/Đủ), lọc Location (gộp cả 3 hoặc 1 — số tồn đổi theo Location), sắp xếp Mã/Tên/Tồn ↑↓. Ô tìm kiếm không mất focus (chỉ vẽ lại `#product-list`).
- Tab **Báo cáo** — 3 chế độ (`reportView`): "Tồn hiện tại", "Tháng ERP", "Tháng Mượn"; có **card bộ lọc chung**: ô tìm Mã/Tên (`rp-q`, lọc mọi chế độ), snapshot có select Trạng thái, chế độ tháng có chọn tháng `‹ [input month] ›` + checkbox "Ẩn dòng toàn số 0". Bảng/thẻ đều có dòng TỔNG.
  - `netTruocNgay(productId, loc, source, cutoff)` — bản JS của `tonTruocNgay()` (cộng dồn Nhập−Xuất mọi giao dịch ngày `< cutoff`).
  - `reportRowERP()` đúng mục 2.4; `reportRowMuon()` đúng mục 2.5 (chỉ Nguồn=Mượn & Location=DF, số dương).
- `computeStock(productId, loc)` — quy ước dấu mới (Tồn mượn dương, Tồn thực tế = ERP − Mượn), `loc=null` cộng dồn cả 3 Location.

**Còn thiếu / có thể cần làm tiếp:**
1. Chưa có xoá/sửa sản phẩm & giao dịch (hiện chỉ thêm mới; đã có `_row` sẵn để làm).
2. Chưa validate "Nguồn=Mượn chỉ hợp lệ khi Location=DF" ở giao diện.
3. Form giao dịch chưa gợi ý nhanh Location theo Loại.
4. Ghi giao dịch dùng 2 lệnh `sheetsUpdate` + 1 `sheetsGet` dò dòng trống — nhiều thao tác liên tiếp có thể chậm; cân nhắc `append`/`batchUpdate`.
5. Chưa xử lý token hết hạn tự động (chỉ báo lỗi, người dùng bấm đăng nhập lại).

## 5. Ràng buộc / lưu ý quan trọng khi sửa code

- **Không bao giờ ghi giá trị tĩnh vào cột C (Tên SP) của sheet Giao dịch** — dù từ Apps Script hay từ app qua Sheets API — vì đây là công thức đã điền sẵn cho 3000 dòng.
- Giá trị Loại/Nguồn phải đúng chính tả có dấu: `"Nhập"`, `"Xuất"`, `"ERP"`, `"Mượn"` — không dùng bản không dấu (`"Nhap"`, `"Xuat"`, `"Muon"`) vì sẽ không khớp với dữ liệu/công thức đang có.
- Tên 3 Location cố định: `"DF"`, `"RETURN"`, `"Tra NCC"` (chú ý khoảng trắng và chữ hoa/thường trong `"Tra NCC"`).
- Ô B3 ở 2 sheet báo cáo tháng lưu giá trị Date thật (ngày 01 hoặc 15 của tháng), chỉ **hiển thị** dạng `MM-yyyy` — khi đọc bằng code phải dùng `getValue()`/giá trị Date gốc, không parse chuỗi hiển thị.
