const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ========== DATA STORAGE ==========
const accounts = {}; // { code: { password, botWebhook, groups, members, lastActive } }
const activeSessions = {}; // { code: lastPingTime }

// ========== HELPER ==========
function isSessionActive(code) {
    const lastPing = activeSessions[code];
    if (!lastPing) return false;
    // Session active if pinged within last 6 minutes (extra buffer)
    return (Date.now() - lastPing) < 6 * 60 * 1000;
}

// ========== STATIC FILES ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ========== AUTH API ==========

// Login - khi user đăng nhập
app.post('/api/login', async (req, res) => {
    const { code, password } = req.body;

    const account = accounts[code];
    if (!account || account.password !== password) {
        return res.json({ success: false, message: 'Sai code hoặc password' });
    }

    // Đánh dấu session active
    activeSessions[code] = Date.now();

    // Ping bot để kết nối
    if (account.botWebhook) {
        try {
            const fetch = (await import('node-fetch')).default;
            await fetch(`${account.botWebhook}/web/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, action: 'login' })
            });
        } catch (e) {
            console.log('Bot not reachable');
        }
    }

    res.json({ success: true, message: 'Đăng nhập thành công' });
});

// Keep-alive ping - client gọi mỗi 5 phút
app.post('/api/ping', async (req, res) => {
    const { code } = req.body;

    if (!accounts[code]) {
        return res.json({ success: false });
    }

    // Cập nhật thời gian active
    activeSessions[code] = Date.now();

    // Ping bot để giữ kết nối
    if (accounts[code].botWebhook) {
        try {
            const fetch = (await import('node-fetch')).default;
            await fetch(`${accounts[code].botWebhook}/web/ping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, timestamp: Date.now() })
            });
        } catch (e) {
            // Bot offline
        }
    }

    res.json({ success: true, active: true });
});

// Logout
app.post('/api/logout', async (req, res) => {
    const { code } = req.body;

    delete activeSessions[code];

    // Thông báo bot ngừng gửi data
    if (accounts[code]?.botWebhook) {
        try {
            const fetch = (await import('node-fetch')).default;
            await fetch(`${accounts[code].botWebhook}/web/disconnect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
        } catch (e) { }
    }

    res.json({ success: true });
});

// ========== DATA API ==========

// Get groups
app.get('/api/groups', (req, res) => {
    const { code } = req.query;
    if (!accounts[code]) {
        return res.json({ success: false });
    }
    res.json({ success: true, groups: accounts[code].groups || {} });
});

// Get members
app.get('/api/members', (req, res) => {
    const { code, groupId } = req.query;
    if (!accounts[code]) {
        return res.json({ success: false });
    }
    res.json({ success: true, members: accounts[code].members?.[groupId] || [] });
});

// Refresh - gọi bot lấy data mới (chỉ khi session active)
app.post('/api/refresh', async (req, res) => {
    const { code } = req.body;
    const account = accounts[code];

    if (!account || !account.botWebhook) {
        return res.json({ success: false });
    }

    // Cập nhật session
    activeSessions[code] = Date.now();

    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`${account.botWebhook}/web/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const data = await response.json();

        if (data.success) {
            account.groups = data.groups;
            account.members = data.members;
        }

        res.json({ success: true, groups: account.groups, members: account.members });
    } catch (e) {
        res.json({ success: false, message: 'Bot offline' });
    }
});

// ========== KICK API ==========
app.post('/api/kick', async (req, res) => {
    const { code, groupId, memberId, memberName } = req.body;
    const account = accounts[code];

    if (!account || !account.botWebhook) {
        return res.json({ success: false, message: 'No bot' });
    }

    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`${account.botWebhook}/web/kick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, groupId, memberId, memberName })
        });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.json({ success: false, message: 'Bot offline' });
    }
});

// Load database
app.post('/api/loaddata', async (req, res) => {
    const { code, groupId } = req.body;
    const account = accounts[code];

    if (!account || !account.botWebhook) {
        return res.json({ success: false });
    }

    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`${account.botWebhook}/web/loaddata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, groupId })
        });
        const data = await response.json();

        if (data.success && data.members) {
            if (!account.members) account.members = {};
            account.members[groupId] = data.members;
        }

        res.json(data);
    } catch (e) {
        res.json({ success: false, message: 'Bot offline' });
    }
});

// ========== BOT API ==========

// Bot đăng ký account
app.post('/bot/register', (req, res) => {
    const { code, password, webhook } = req.body;

    accounts[code] = {
        password,
        botWebhook: webhook,
        groups: {},
        members: {}
    };

    console.log(`[REGISTER] ${code} - Webhook: ${webhook}`);
    res.json({ success: true });
});

// Bot gửi data lên
app.post('/bot/update', (req, res) => {
    const { code, groups, members } = req.body;

    if (!accounts[code]) {
        return res.json({ success: false });
    }

    if (groups) accounts[code].groups = groups;
    if (members) Object.assign(accounts[code].members || {}, members);

    res.json({ success: true });
});

// Bot kiểm tra session có active không
app.get('/bot/session', (req, res) => {
    const { code } = req.query;
    res.json({ success: true, active: isSessionActive(code) });
});

// ========== HEALTH ==========
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        accounts: Object.keys(accounts).length,
        activeSessions: Object.keys(activeSessions).filter(c => isSessionActive(c)).length
    });
});

// ========== START ==========
app.listen(PORT, () => {
    console.log(`[SERVER] Running on port ${PORT}`);
});
