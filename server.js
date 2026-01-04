const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ========== DATA ==========
const accounts = {};
const kickQueue = {};
const loadQueue = {};
const botStatus = {}; // { code: lastUpdate }

// ========== PAGES ==========
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

// ========== AUTH ==========
app.post('/api/login', (req, res) => {
    const { code, password } = req.body;
    const account = accounts[code];

    if (!account || account.password !== password) {
        return res.json({ success: false, message: 'Sai code hoặc password' });
    }

    res.json({ success: true });
});

// ========== DATA ==========
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

// Kiểm tra bot có đang kết nối không (cập nhật trong 60s)
app.get('/api/status', (req, res) => {
    const { code } = req.query;
    const lastUpdate = botStatus[code];
    const isConnected = lastUpdate && (Date.now() - lastUpdate) < 60000;
    res.json({
        success: true,
        connected: isConnected,
        lastUpdate: lastUpdate ? new Date(lastUpdate).toISOString() : null
    });
});

// ========== ACTIONS ==========
app.post('/api/kick', (req, res) => {
    const { code, groupId, memberId, memberName } = req.body;
    if (!accounts[code]) return res.json({ success: false });

    if (!kickQueue[code]) kickQueue[code] = [];
    kickQueue[code].push({ groupId, memberId, memberName, timestamp: Date.now() });

    res.json({ success: true, message: `Đã gửi lệnh kick ${memberName}` });
});

app.post('/api/loaddata', (req, res) => {
    const { code, groupId } = req.body;
    if (!accounts[code]) return res.json({ success: false });

    if (!loadQueue[code]) loadQueue[code] = [];
    loadQueue[code].push({ groupId, timestamp: Date.now() });

    res.json({ success: true, message: 'Đã yêu cầu sync' });
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

    if (!accounts[code]) {
        accounts[code] = { password: '', groups: {}, members: {} };
    }

    if (groups) accounts[code].groups = groups;
    if (members) accounts[code].members = members;

    // Cập nhật trạng thái kết nối
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

// ========== HEALTH ==========
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/ping', (req, res) => res.send('pong'));

// ========== START ==========
app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
