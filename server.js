const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// ========== DATA (mỗi code riêng biệt) ==========
const accounts = {};
const kickQueue = {};
const loadQueue = {};
const forceSyncQueue = {};
const clearTimeQueue = {};
const botStatus = {};

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

// ========== HEALTH ==========
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/ping', (req, res) => res.send('pong'));

app.listen(PORT, () => console.log(`Server: ${PORT}`));
