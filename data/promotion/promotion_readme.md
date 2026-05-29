🏷️ Promotions Data Structure – VGreen E-commerce

📘 Tổng quan
Hệ thống khuyến mãi trong cơ sở dữ liệu VGreen được chia thành 3 collection chính, giúp quản lý chương trình khuyến mãi, phạm vi áp dụng, và lịch sử sử dụng một cách linh hoạt và tách biệt.
---

1️⃣ promotions.json – Thông tin khuyến mãi
Đây là collection trung tâm, lưu toàn bộ thông tin mô tả khuyến mãi, bao gồm:
- loại khuyến mãi (cho user hoặc admin)
- phạm vi áp dụng (đơn hàng, sản phẩm, danh mục, phí vận chuyển)
- hình thức giảm giá (phần trăm hoặc giá trị cố định)
- điều kiện sử dụng, giới hạn, thời gian hiệu lực, v.v.
---

2️⃣ promotion_target.json – Phạm vi áp dụng khuyến mãi
Vì một khuyến mãi (promotion) có thể chỉ áp dụng cho một danh mục, sản phẩm, hoặc nhóm sản phẩm nhất định, nên phần thông tin này được tách ra để dễ mở rộng và truy vấn.
- promotion_id: khóa ngoại, tham chiếu đến promotion chính trong promotions.json.
- target_type: mô tả phạm vi đối tượng (ví dụ: “Category” nghĩa là áp dụng theo danh mục).
- target_ref: danh sách các giá trị cụ thể — có thể là tên sản phẩm, mã sản phẩm (SKU), hoặc tên danh mục.
---

3️⃣ promotion_usage.json – Lịch sử sử dụng mã khuyến mãi
Lưu lại các lần áp dụng mã khuyến mãi, phục vụ mục đích:
- Kiểm soát số lần sử dụng (usage_limit)
- Giới hạn người dùng (user_limit)
- Theo dõi hiệu quả chiến dịch khuyến mãi

Giải thích:
- promotion_id: liên kết với promotions.json
- user_id: danh sách người dùng đã áp mã này
- order_id: danh sách đơn hàng nơi mã được sử dụng
