# 📊 Web Tương Tác - Hướng Dẫn

## 🚀 Cài Đặt

### 1. Deploy lên Render
1. Push `webchecktuongtac` lên GitHub
2. Render.com → New Web Service
3. Cấu hình:
   - Root: `webchecktuongtac`
   - Build: `npm install`
   - Start: `npm start`
4. Lấy URL: `https://xxx.onrender.com`

### 2. Cấu hình Bot
```
/code https://xxx.onrender.com
```

### 3. Bật Auto Sync
```
/websync on
```

### 4. Đăng nhập Web
- Mở URL Render
- Nhập CODE + PASS (từ lệnh /code)

---

## 📋 Lệnh Bot

| Lệnh | Mô tả |
|------|-------|
| `/code [url]` | Tạo mã đăng nhập |
| `/websync on` | Bật auto sync (30s) |
| `/websync off` | Tắt auto sync |
| `/websync` | Sync 1 lần |

---

## 🔄 Cách Hoạt Động

```
Bot → (mỗi 30s) → Gửi data lên Render

Web → Hiển thị data từ Render

Web Click Kick → Lưu vào queue → Bot poll & kick
```

- **Bot tự động gửi** data lên server mỗi 30 giây
- **Không cần expose IP** của bot
- Web hiển thị trạng thái: 🟢 Online / 🔴 Offline

---

## ⚠️ Lưu Ý

- Render free sleep sau 15 phút → Dùng Uptime Robot
- URL Uptime: `https://xxx.onrender.com/ping`
