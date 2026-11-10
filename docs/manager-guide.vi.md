# Hướng dẫn cho quản lý điểm nhận xe

[RU](manager-guide.ru.md) · [EN](manager-guide.en.md)

> Bản tiếng Việt cần người bản ngữ kiểm tra (xem `packages/i18n/glossary.md`).

Bạn làm việc trong cùng ứng dụng với khách: mở bot → «Thuê xe» → **Hồ sơ → Chế độ quản lý**. Mục này chỉ hiện khi quản trị viên đã chỉ định bạn làm quản lý điểm (theo Telegram ID của bạn). Bot gửi cho bạn các đơn mới và lúc 20:00 gửi danh sách xe cần giao ngày mai; nút trong tin nhắn mở chế độ quản lý.

## Các mục

- **Hôm nay** — «Giao xe» và «Nhận xe» trong ngày. Đơn trễ có nhãn «Quá hạn»; đơn trả tiền mặt hiện số tiền cần thu. Danh sách tự cập nhật.
- **Đội xe** — xe của điểm: trạng thái, số km, sửa chữa.

## Tìm đơn

- **Quét mã QR** — đưa camera vào mã QR trên màn hình của khách.
- Nếu camera không mở được, nhập **Mã đơn** (ví dụ BK-10001) và bấm «Tìm đơn».

Thẻ đơn hiển thị khách, số điện thoại, ngày thuê, mẫu xe, thanh toán và giấy tờ của khách.

## Giấy tờ của khách

Đối chiếu bản gốc (hộ chiếu, bằng lái, bằng lái quốc tế IDP) với ảnh đã tải lên bằng nút «Mở». Quản trị viên kiểm tra và quyết định với từng giấy tờ; kết quả hiển thị trên thẻ. Liên kết tới tệp có hiệu lực 10 phút. Nếu khách chưa tải lên, hãy kiểm tra bản gốc tại chỗ.

Người nước ngoài cần bằng lái quốc gia và IDP theo Công ước Viên 1968, hạng A1 (đến 125 cc) hoặc A (từ 150 cc).

## Giao xe

1. Trong đơn — **Giao xe**.
2. **Xe** — chọn đúng xe theo biển số trong các xe trống cùng mẫu (có thể khác xe hệ thống đã giữ).
3. **Số km** và **Nhiên liệu**.
4. **Ảnh xe** — từ 4 đến 8 ảnh từ mọi phía.
5. **Hư hỏng trước khi giao** — vết xước, sứt mẻ đã có sẵn.
6. **Tạo biên bản giao xe** — biên bản được gửi cho khách.
7. Khách xác nhận biên bản trong ứng dụng của họ. Bấm **Kiểm tra xác nhận**: «Khách đã xác nhận biên bản. Xe đã được giao.» — chỉ sau đó mới giao chìa khóa.

## Tiền mặt

Nếu khách trả khi nhận xe: **Thu tiền mặt** → số tiền («Toàn bộ số tiền» điền phần còn lại) → **Khoản thu**: tiền thuê, tiền cọc, trả trước hoặc phụ thu → **Nhận tiền mặt**.

## Nhận xe trả

1. Tìm đơn (QR hoặc mã) → **Nhận xe**.
2. **Số km khi trả**, **Nhiên liệu**, **Ảnh khi trả**, **Hư hỏng** — những gì mới phát sinh trong thời gian thuê.
3. **Trả muộn** được tính tự động: trễ đến 1 giờ miễn phí, sau đó phụ thu theo giờ theo cài đặt.
4. **Khấu trừ tiền cọc** — «Thêm khoản khấu trừ»: số tiền, lý do, ảnh hư hỏng. Khấu trừ không được vượt quá tiền cọc.
5. Kiểm tra tổng: **Hoàn lại tiền cọc** và **Phụ thu cần thu**.
6. **Nhận xe và đóng đơn** — đơn chuyển sang «Hoàn tất». Phụ thu bằng tiền mặt thu qua «Thu tiền mặt» → «Phụ thu».

## Khách không đến

Nếu khách không đến nhận xe: trong đơn bấm **Khách không đến** → **Ghi nhận không đến**. Đơn bị hủy, tiền hoàn theo quy tắc hủy. Sau 3 giờ kể từ giờ bắt đầu, hệ thống tự hủy đơn như vậy.

## Sửa chữa

Mục **Đội xe** → chọn xe → **Đưa đi sửa**, chọn **Sửa xong ngày** (có thể bỏ trống). Trước ngày đó xe không được cho đặt. Sửa xong — **Đưa vào hoạt động**.

## Khi có sự cố

| Tình huống | Cách xử lý |
|---|---|
| Khách nói đã chuyển tiền nhưng đơn vẫn «Chờ thanh toán» | Đợi một phút — trạng thái tự cập nhật. Không giao xe khi chưa «Đã xác nhận». Nếu vẫn không đổi, nhắn quản trị viên. |
| Không còn xe trống cùng mẫu | Báo quản trị viên — họ sẽ đổi xe cho đơn hoặc liên hệ khách. |
| Mã QR của điểm khác | Ứng dụng báo lỗi: đơn thuộc điểm khác. |
| Khách báo sự cố trên đường | Bot gửi tin nhắn cho bạn; gọi cho khách theo số điện thoại trong đơn. |

## Không có xe tại điểm

Khách có thể báo trong ứng dụng, còn bạn dùng nút "Xe này không có tại điểm" trong đơn. Đơn được đánh dấu "Không có xe". Hãy xử lý ngay:

1. **Còn xe giống vậy.** Chọn biển số khác trong mẫu giao xe: trường hợp tự đóng.
2. **Còn mẫu xe khác.** Chọn xe trong khối "Không có xe tại điểm" và nhấn "Đề xuất cho khách". Đắt hơn: khách không trả thêm. Rẻ hơn: phần chênh lệch được hoàn lại.
3. **Xe vẫn có.** Nhấn "Xe có tại điểm". Quản trị viên sẽ nhận được thông báo.
4. **Không có xe thay thế.** Nhấn "Hủy và hoàn toàn bộ tiền" rồi chuyển tiền cho khách.

Trong khi khách chờ trả lời, nút "Không đến" và hủy thông thường bị khóa. Sau 15 phút không trả lời, quản trị viên được báo và khách có thể tự hủy.
