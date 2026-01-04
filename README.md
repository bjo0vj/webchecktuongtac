# 📊 Hướng Dẫn Sử Dụng Web Tương Tác Server

## 🚀 Cài Đặt Nhanh

### Bước 1: Deploy lên Render
1. Push folder `webchecktuongtac` lên GitHub
2. Vào [render.com](https://render.com) → New Web Service
3. Connect repo GitHub
4. Cấu hình:
   - **Root Directory**: `webchecktuongtac`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Deploy và lấy URL (ví dụ: `https://abc.onrender.com`)

### Bước 2: Cấu hình Bot
```
/code https://abc.onrender.com http://your-bot-ip:3002
```
Lệnh này tạo file `code.txt` với:
- Dòng 1: Code đăng nhập (10 số)
- Dòng 2: Password (10 số)
- Dòng 3: Render URL
- Dòng 4: Bot Webhook URL

### Bước 3: Khởi động Bot Webhook
```
/webserver
```
Bot sẽ lắng nghe trên port 3002.

### Bước 4: Đăng nhập Web
1. Mở URL Render: `https://abc.onrender.com`
2. Nhập Code và Password từ bước 2
3. Xem danh sách nhóm và thành viên

---

## 📋 Các Lệnh Bot

| Lệnh | Mô tả |
|------|-------|
| `/code [render_url] [bot_url]` | Tạo code.txt đăng nhập |
| `/webserver [port]` | Khởi động webhook server |
| `/autochecktuongtac on/off` | Bật/tắt theo dõi nhóm |
| `/checktuongtac` | Xem tương tác trong nhóm |
| `/loaddatabase` | Sync thành viên nhóm |

---

## 🔗 Endpoints Bot (port 3002)

| Endpoint | Mô tả |
|----------|-------|
| `GET /ping` | Health check cho Uptime Robot |
| `GET /health` | Trạng thái server |
| `POST /web/sync` | Lấy dữ liệu nhóm |
| `POST /web/kick` | Kick thành viên |
| `POST /web/loaddata` | Sync lại nhóm |

---

## 🤖 Uptime Robot

Để giữ Render không sleep, thêm monitor:
1. Vào [uptimerobot.com](https://uptimerobot.com)
2. Add New Monitor → HTTP(s)
3. URL: `https://abc.onrender.com/health`
4. Interval: 5 minutes

Cho bot webhook:
- URL: `http://your-bot-ip:3002/ping`

---

## 🔄 Luồng Hoạt Động

```
User Login → Render ping Bot → Bot gửi data → Hiển thị

User Click Kick → Render gọi Bot → Bot kick ngay → Done

Web ping Bot mỗi 5 phút → Giữ kết nối
```

---

## ⚠️ Lưu Ý

1. **Bot phải expose port 3002** ra internet (dùng ngrok hoặc VPS)
2. **Render free sleep** sau 15 phút không dùng → Dùng Uptime Robot
3. **Chỉ gửi data** khi có user đang login → Tiết kiệm tài nguyên
