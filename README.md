# FinalWeb_VGreen

Dự án Fullstack E-commerce VGreen - Hệ thống quản lý và bán hàng thực phẩm xanh.

## ⚡ Lệnh tổng hợp - Bắt đầu nhanh

```bash
# 1. Cài đặt dependencies (từ root)
npm run setup

# 2. Import dữ liệu vào MongoDB (từ root)
npm run import-json

# Terminal 1: Chạy Backend
cd backend
npm start

# Terminal 2: Chạy Frontend User
cd my-user
ng serve --o  # hoặc npm run start:open

# Terminal 3: Chạy Frontend Admin
cd my-admin
ng serve --o  # hoặc npm run start:open
```

**Lưu ý quan trọng:**

- Đảm bảo MongoDB đã được cài đặt và đang chạy trước khi chạy backend
- Nếu chưa có `node_modules`, chạy `npm run setup` trước tiên
- Các lệnh `ng serve --o` sẽ tự động mở trình duyệt

---

## 📋 Yêu cầu hệ thống

- **Node.js**: phiên bản 18.x trở lên
- **npm**: phiên bản 9.x trở lên (hoặc yarn)
- **MongoDB**: phiên bản 6.x trở lên (đã cài đặt và đang chạy)
- **Git**: để clone repository

## 📁 Cấu trúc dự án

```
FinalWeb_VGreen/
├── backend/              # Backend API (Node.js + Express + Supabase)
├── my-user/              # Frontend User (Angular)
├── my-admin/             # Frontend Admin (Angular)
├── data/                 # Dữ liệu JSON để import vào Supabase / MongoDB
├── asset/                # Assets chung (images, icons, fonts)
├── setup.js              # Script tự động cài đặt dependencies
└── package.json          # Root package.json
```
> Ghi chú: Backend hiện tại đã được sửa sang Supabase. Bạn có thể dùng `backend/server.supabase.js` để chạy backend bằng Supabase.
>
> - Script import Supabase: `scripts/import-to-supabase.js`
> - Môi trường cần thêm: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
> - Nếu muốn chạy lại bằng MongoDB, giữ nguyên `backend/server.js` và cấu hình `MONGODB_URI`.
## 🚀 Hướng dẫn cài đặt

### Bước 1: Clone repository

```bash
git clone <repository-url>
cd FinalWeb_VGreen
```

### Bước 2: Cài đặt dependencies

**Cách 1: Tự động (Khuyến nghị)**

Chạy script tự động để cài đặt tất cả dependencies cho toàn bộ dự án:

```bash
npm run setup
```

Script này sẽ tự động:

- Cài đặt dependencies cho root project
- Cài đặt dependencies cho backend
- Cài đặt dependencies cho my-user (Angular)
- Cài đặt dependencies cho my-admin (Angular)

**Cách 2: Thủ công**

Nếu muốn cài đặt thủ công từng phần:

```bash
# Cài đặt root dependencies
npm install

# Cài đặt backend dependencies
cd backend
npm install
cd ..

# Cài đặt my-user dependencies
cd my-user
npm install --include=dev --force
cd ..

# Cài đặt my-admin dependencies
cd my-admin
npm install --include=dev --force
cd ..
```

### Bước 3: Cấu hình Supabase (hoặc MongoDB)

1. Nếu dùng Supabase, thiết lập các biến môi trường trong `backend/.env`:
   - `SUPABASE_URL=https://<your-project>.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>`
2. Nếu muốn dùng MongoDB cũ, giữ nguyên cấu hình `MONGODB_URI` trong `backend/.env`.
3. Với Supabase, bạn cần tạo bảng tương ứng với các collection hiện tại và import dữ liệu.

### Bước 4: Import dữ liệu vào Supabase hoặc MongoDB (Tùy chọn)

Nếu cần import dữ liệu từ các file JSON vào MongoDB:

```bash
npm run import-json
```

Nếu cần import dữ liệu từ các file JSON vào Supabase:

```bash
npm run import-supabase
```

Lưu ý: `npm run import-supabase` sẽ quét toàn bộ `*.json` trong thư mục `data/` và import từng file theo tên bảng.

## ▶️ Hướng dẫn chạy

### Chạy Backend

```bash
npm run backend
```

Backend sẽ chạy tại: `http://localhost:3000`

### Chạy Frontend User

**Cách 1: Chạy riêng lẻ**

```bash
cd my-user
npm start
```

**Cách 2: Chạy cùng Backend (Khuyến nghị)**

```bash
npm run serve
```

Frontend User sẽ chạy tại: `http://localhost:4200`

### Chạy Frontend Admin

```bash
cd my-admin
npm start
```

Frontend Admin sẽ chạy tại: `http://localhost:4200` (nếu my-user không đang chạy)

### Chạy tất cả cùng lúc (Backend + User)

```bash
npm run serve
```

## ☁️ Triển khai Cloudflare Pages

Dự án có cấu hình GitHub Actions để triển khai hai app riêng biệt lên Cloudflare Pages:

- `my-user` => `my-user/dist/my-user`
- `my-admin` => `my-admin/dist/my-admin`

### Thiết lập secrets GitHub
Trong repository GitHub, thêm các secrets sau:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PROJECT_NAME_USER`
- `CLOUDFLARE_PROJECT_NAME_ADMIN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_EMAIL_DOMAIN`

### Cách hoạt động

1. GitHub Action sẽ chạy khi có push lên repo và build app tương ứng.
2. `scripts/generate-supabase-config.js` sẽ tạo `supabase.config.ts` dùng giá trị secrets.
3. App được build và đẩy lên Cloudflare Pages với tên project tương ứng.

> Lưu ý: Backend vẫn cần được host riêng nếu app vẫn phụ thuộc vào API server. Nếu chỉ dùng Supabase Auth/DB cho front-end, backend URL phải được cấu hình phù hợp.

## 📝 Các lệnh hữu ích

### Lệnh từ root directory

```bash
# Cài đặt tất cả dependencies
npm run setup

# Chạy backend
npm run backend

# Chạy backend + my-user
npm run serve

# Import dữ liệu JSON vào MongoDB
npm run import-json

# Fix lỗi Angular build (nếu gặp lỗi @angular/build)
npm run fix-angular

# Kiểm tra dữ liệu trong MongoDB
npm run check-data

# Liệt kê các collections trong MongoDB
npm run list-collections

# Khởi tạo database
npm run init-db
```

### Lệnh Backend

```bash
cd backend

# Chạy server
npm start

# Chạy với nodemon (auto-reload)
npm run dev

# Import tất cả JSON vào MongoDB
npm run import-all-json

# Tính toán tổng chi tiêu và phân hạng khách hàng
npm run calculate-totalspent

# Đồng bộ dữ liệu users
npm run sync-users:to-mongo
```

### Lệnh Frontend (my-user / my-admin)

```bash
cd my-user  # hoặc cd my-admin

# Chạy development server
npm start

# Build production
npm run build

# Build và watch
npm run watch

# Chạy tests
npm test
```

## 🔧 Troubleshooting

### Lỗi: Cannot find module @angular/build

Nếu gặp lỗi này khi chạy Angular project:

```bash
npm run fix-angular
```

Hoặc thủ công:

```bash
cd my-user  # hoặc my-admin
rm -rf node_modules package-lock.json
npm install --include=dev --force
```

### Lỗi: MongoDB connection failed

1. Kiểm tra MongoDB đã được cài đặt và đang chạy:

   ```bash
   # Windows
   net start MongoDB

   # Linux/Mac
   sudo systemctl start mongod
   ```

2. Kiểm tra connection string trong `backend/config/database.js` hoặc `backend/db.js`

3. Đảm bảo MongoDB đang lắng nghe tại port 27017

### Lỗi: Port already in use

Nếu port 3000 hoặc 4200 đã được sử dụng:

- **Backend (port 3000)**: Thay đổi trong `backend/server.js`
- **Frontend (port 4200)**: Chạy với port khác:
  ```bash
  cd my-user
  ng serve --port 4201
  ```

### Lỗi: npm install fails

1. Xóa `node_modules` và `package-lock.json`:

   ```bash
   rm -rf node_modules package-lock.json
   ```

2. Clear npm cache:

   ```bash
   npm cache clean --force
   ```

3. Cài đặt lại:
   ```bash
   npm install
   ```

### Lỗi: Angular build errors

```bash
# Chạy fix script
npm run fix-angular

# Hoặc thủ công
cd my-user  # hoặc my-admin
rm -rf node_modules package-lock.json
npm install --include=dev --force
```

## 📚 Thông tin bổ sung

### API Endpoints

Backend API chạy tại: `http://localhost:3000/api`

Các endpoints chính:

- `/api/auth` - Authentication
- `/api/products` - Quản lý sản phẩm
- `/api/orders` - Quản lý đơn hàng
- `/api/users` - Quản lý người dùng
- `/api/address` - Quản lý địa chỉ
- `/api/promotions` - Quản lý khuyến mãi
- `/api/reviews` - Quản lý đánh giá
- `/api/tree_complete` - Dữ liệu địa chỉ Việt Nam

### Database Collections

Các collections chính trong MongoDB:

- `users` - Người dùng
- `products` - Sản phẩm
- `orders` - Đơn hàng
- `addresses` - Địa chỉ
- `promotions` - Khuyến mãi
- `reviews` - Đánh giá
- `dishes` - Sổ tay nấu ăn
- `tree_complete` - Dữ liệu địa chỉ Việt Nam (63 tỉnh thành)

### Development Workflow

1. **Khởi động MongoDB**
2. **Chạy Backend**: `npm run backend`
3. **Chạy Frontend**: `npm run serve` (hoặc `cd my-user && npm start`)
4. **Truy cập**:
   - User: `http://localhost:4200`
   - Admin: `http://localhost:4200` (sau khi chạy my-admin)

## 👥 Đóng góp

Khi làm việc với dự án:

1. **Không commit `node_modules`** - Đã được thêm vào `.gitignore`
2. **Chạy `npm run setup`** sau khi clone để cài đặt dependencies
3. **Kiểm tra MongoDB** đang chạy trước khi start backend
4. **Sử dụng `npm run fix-angular`** nếu gặp lỗi Angular build

## 📞 Hỗ trợ

Nếu gặp vấn đề, hãy:

1. Kiểm tra phần Troubleshooting ở trên
2. Đảm bảo đã cài đặt đầy đủ dependencies bằng `npm run setup`
3. Kiểm tra MongoDB đang chạy
4. Kiểm tra các port không bị conflict

---

**Lưu ý**: Đảm bảo chạy `npm run setup` trước khi bắt đầu phát triển để cài đặt tất cả dependencies cần thiết.
