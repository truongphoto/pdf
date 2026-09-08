QR CHỈ DẪN ĐỊA ĐIỂM THẨM ĐỊNH - TRƯỜNG GPP (v8)

Mục đích:
- Tạo sơ đồ địa điểm kinh doanh phục vụ hồ sơ thẩm định.
- Tạo QR chỉ đường đến đúng vị trí.
- Gắn icon đánh dấu, thêm tên tuyến đường thủ công, xoay/kéo nhãn.
- Thêm lưu ý đường đi khi đường khó tìm, đang sửa chữa hoặc lối vào đặc biệt.
- Xuất hồ sơ theo Letter (mẫu gốc) hoặc A4.

Nhận diện phần mềm:
Tác giả: Ngô Quang Trường
Điện thoại: 0829 076 979
Zalo: truongphotoart

Điểm mới v8:
- Giao diện gom toàn bộ thao tác vào một panel duy nhất, mỗi lần chỉ mở một nhóm chức năng.
- Thanh thao tác nhanh luôn sẵn: Cập nhật / Kiểm tra QR / Xuất PDF.
- Thêm lựa chọn khổ A4 210 x 297 mm.
- Khi chọn A4, biểu mẫu Letter gốc được thu/phóng đồng tỷ lệ và căn giữa trên trang A4 để không làm méo mẫu.

Cách dùng:
1. Mở index.html bằng trình duyệt.
2. Nhập tên vị trí, địa chỉ hoặc tọa độ.
3. Chọn biểu tượng và chỉnh vị trí bằng chuột khi cần.
4. Mở phần 3 để thêm tên đường/mốc, kéo và xoay nhãn cho đúng thực tế.
5. Kiểm tra QR chỉ đường trước khi xuất.
6. Mở phần 5 để chọn Letter hoặc A4, sau đó In / Lưu PDF.

Lưu ý:
- Nhận diện TRƯỜNG GPP chỉ nằm trên giao diện phần mềm; khi in/PDF, phần tác giả và logo phần mềm không in vào biểu mẫu hành chính.
- Google Maps tự quyết định một phần tên đường hiển thị theo mức zoom; nhãn thủ công dùng để bổ sung khi cần.


BẢN V10: Favicon/tab trình duyệt và biểu tượng khi cài ứng dụng dùng icon y tế ghim xanh dương + dấu thập xanh, tách biệt với biểu tượng Trang Chủ. Có manifest.json và sw.js cho PWA khi chạy trên HTTPS/hosting.


BẢN v12
- Nút Cài đặt chỉ hiện khi ứng dụng chưa được cài và trình duyệt hỗ trợ PWA.
- Nút Cập nhật chỉ hiện khi có phiên bản mới đang chờ áp dụng.
- Tách riêng In và Export PDF.
- Export PDF trực tiếp cần Google Static Maps API key để giữ đầy đủ bản đồ trong file PDF.


BỔ SUNG v12:
- Nút In hồ sơ và Export PDF phía trên đồng bộ kích thước, icon và phong cách.
- Khu Google Static Maps API riêng: hiện/ẩn key, kiểm tra API, trạng thái và link hướng dẫn chính thức.
- API key không được tự lưu vào trình duyệt. Nên giới hạn key cho website và Maps Static API.


BỔ SUNG v13:
- Tăng mạnh cỡ chữ phần LƯU Ý trên bản xem trước và bản in/PDF.
- Thêm nền trắng, viền rõ và nhấn đậm nhãn LƯU Ý để tránh bị bỏ qua.
- Tăng chiều cao vùng lưu ý để nội dung dài dễ đọc hơn.


BẢN v15
- Thêm chọn kích thước chữ LƯU Ý 7.5–11 pt, mặc định 9 pt.
- Sửa lỗi Export PDF bị cắt bản đồ ở mép phải/phía dưới.
- Google Static Maps được yêu cầu theo đúng tỷ lệ khung Letter/A4 thay vì ảnh vuông 640x640.
- Export PDF chuyển sang chụp toàn bộ sheet ở kích thước cố định rồi đặt thành 1 ảnh toàn trang PDF để tránh html2pdf/pagebreak cắt mép.


V16: Cỡ chữ Lưu ý 9–12.5 pt; Địa chỉ theo hồ sơ được hiển thị trên biểu mẫu; tránh reload bản đồ khi chỉ sửa địa chỉ hồ sơ; sửa luồng In/Export để chờ Static Maps và tránh cắt mép phải/dưới.


V17: WYSIWYG 1:1. Preview, Print và Export PDF dùng cùng một sheet chuẩn cố định. Để bản đồ cũng giống 100%, nhập Google Static Maps API key; khi đó In/PDF được tạo từ ảnh chụp chính sheet preview.


V18 - CHẾ ĐỘ KHÔNG CẦN API KEY
- In hoạt động mặc định với Google Maps nhúng, không bắt buộc Google Static Maps API key.
- Export PDF khi chưa có key sẽ mở hộp thoại in; chọn Save as PDF / Lưu dưới dạng PDF.
- Nếu nhập API key riêng, Export PDF trực tiếp 1:1 vẫn hoạt động như trước.
- Không có API key dùng chung được nhúng sẵn vì Google Maps key là thông tin tài khoản/billing riêng.


V19:
- Export PDF không cần Google Static Maps API.
- Khi trình duyệt hỗ trợ Screen Capture (Chrome/Edge trên HTTPS), phần mềm chụp trực tiếp tờ xem trước đang hiển thị, gồm cả Google Maps iframe, rồi lưu thành PDF.
- Khi trình duyệt hỏi quyền, chọn TAB HIỆN TẠI để cắt đúng biểu mẫu.
- Nếu trình duyệt không hỗ trợ hoặc mở bằng file://, phần mềm tự chuyển sang In / Save as PDF.
- Phần LƯU Ý có checkbox Có lưu ý đường đi; nếu không chọn hoặc nội dung trống, khung LƯU Ý không xuất hiện trên biểu mẫu.
