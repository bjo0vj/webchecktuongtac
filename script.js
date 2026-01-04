const API_URL = window.location.origin;
let currentGroupId = null;
let groupsData = {};
let membersData = {};

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function () {
    const userCode = localStorage.getItem('userCode');
    if (!userCode) {
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('userCode').textContent = `Code: ${userCode}`;
    loadData();
    checkBotStatus();

    // Refresh mỗi 30 giây
    setInterval(loadData, 30000);
    setInterval(checkBotStatus, 30000);
});

// ========== BOT STATUS ==========
async function checkBotStatus() {
    const userCode = localStorage.getItem('userCode');
    try {
        const res = await fetch(`${API_URL}/api/status?code=${userCode}`);
        const data = await res.json();

        const statusEl = document.getElementById('botStatus');
        if (statusEl) {
            if (data.connected) {
                statusEl.innerHTML = '<span style="color:#10b981">🟢 Bot Online</span>';
            } else {
                statusEl.innerHTML = '<span style="color:#ef4444">🔴 Bot Offline</span>';
            }
        }
    } catch (e) {
        const statusEl = document.getElementById('botStatus');
        if (statusEl) statusEl.innerHTML = '<span style="color:#f59e0b">⚠️ Checking...</span>';
    }
}

// ========== LOGOUT ==========
function logout() {
    localStorage.removeItem('userCode');
    localStorage.removeItem('userPass');
    window.location.href = 'index.html';
}

// ========== LOAD DATA ==========
async function loadData() {
    const userCode = localStorage.getItem('userCode');
    try {
        const res = await fetch(`${API_URL}/api/groups?code=${userCode}`);
        const data = await res.json();
        if (data.success) {
            groupsData = data.groups || {};
            renderGroups();
        }
    } catch (e) {
        showToast('Không thể tải dữ liệu', 'error');
    }
}

// ========== RENDER GROUPS ==========
function renderGroups() {
    const groupList = document.getElementById('groupList');

    if (Object.keys(groupsData).length === 0) {
        groupList.innerHTML = '<div class="empty-state" style="padding:40px 20px;"><span class="icon">📭</span><p>Chờ bot sync...</p></div>';
        return;
    }

    let html = '';
    for (const [groupId, group] of Object.entries(groupsData)) {
        const isActive = groupId === currentGroupId ? 'active' : '';
        html += `
            <div class="group-item ${isActive}" onclick="selectGroup('${groupId}')">
                <div class="group-name">${group.name || groupId}</div>
                <div class="group-meta">👥 ${group.memberCount || 0}</div>
            </div>
        `;
    }
    groupList.innerHTML = html;
}

// ========== SELECT GROUP ==========
async function selectGroup(groupId) {
    currentGroupId = groupId;
    const group = groupsData[groupId];

    document.querySelectorAll('.group-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`.group-item[onclick="selectGroup('${groupId}')"]`)?.classList.add('active');

    document.getElementById('currentGroupName').textContent = group.name || groupId;
    document.getElementById('btnLoadData').style.display = 'block';

    await loadMembers(groupId);
}

// ========== LOAD MEMBERS ==========
async function loadMembers(groupId) {
    const container = document.getElementById('membersContainer');
    container.innerHTML = '<div class="loading-box">⏳ Đang tải...</div>';

    try {
        const userCode = localStorage.getItem('userCode');
        const res = await fetch(`${API_URL}/api/members?code=${userCode}&groupId=${groupId}`);
        const data = await res.json();

        if (data.success) {
            membersData[groupId] = data.members || [];
            renderMembers(groupId);
        }
    } catch (e) {
        container.innerHTML = '<div class="empty-state"><p>Lỗi</p></div>';
    }
}

// ========== RENDER MEMBERS ==========
function renderMembers(groupId) {
    const container = document.getElementById('membersContainer');
    const members = membersData[groupId] || [];

    if (members.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="icon">👥</span><p>Chưa có dữ liệu</p></div>';
        return;
    }

    members.sort((a, b) => (b.day || 0) - (a.day || 0));

    let html = '';
    members.forEach((m, i) => {
        html += `
            <div class="member-card">
                <div class="member-header">
                    <div class="member-name">${m.name || 'User'}</div>
                    <div class="member-rank">#${i + 1}</div>
                </div>
                <div class="member-stats">
                    <div class="stat-item"><div class="stat-value">${m.day || 0}</div><div class="stat-label">Ngày</div></div>
                    <div class="stat-item"><div class="stat-value">${m.week || 0}</div><div class="stat-label">Tuần</div></div>
                    <div class="stat-item"><div class="stat-value">${m.total || 0}</div><div class="stat-label">Tổng</div></div>
                </div>
                <div class="member-last-active">🕐 ${getTimeAgo(m.lastInteract)}</div>
                <div class="member-actions">
                    <button class="btn-kick" onclick="kickMember('${groupId}', '${m.id}', '${m.name}')">🚫 Kick</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ========== KICK ==========
async function kickMember(groupId, memberId, memberName) {
    if (!confirm(`Kick "${memberName}"?`)) return;

    const userCode = localStorage.getItem('userCode');
    try {
        const res = await fetch(`${API_URL}/api/kick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: userCode, groupId, memberId, memberName })
        });
        const data = await res.json();

        if (data.success) {
            showToast(`✅ ${data.message}`, 'success');
            membersData[groupId] = membersData[groupId].filter(m => m.id !== memberId);
            renderMembers(groupId);
        } else {
            showToast('❌ Lỗi', 'error');
        }
    } catch (e) {
        showToast('❌ Lỗi', 'error');
    }
}

// ========== LOAD GROUP DATA ==========
async function loadGroupData() {
    if (!currentGroupId) return;
    showToast('⏳ Đang yêu cầu sync...', 'success');

    try {
        const userCode = localStorage.getItem('userCode');
        await fetch(`${API_URL}/api/loaddata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: userCode, groupId: currentGroupId })
        });
        showToast('✅ Đã gửi yêu cầu, chờ bot xử lý', 'success');
    } catch (e) {
        showToast('❌ Lỗi', 'error');
    }
}

// ========== UTILS ==========
function getTimeAgo(dateStr) {
    if (!dateStr || dateStr === '-') return 'Chưa có';
    try {
        const [time, date] = dateStr.split(' ');
        const [h, m, s] = time.split(':');
        const [d, mo, y] = date.split('/');
        const dt = new Date(y, mo - 1, d, h, m, s);
        const diff = Date.now() - dt;
        const hrs = Math.floor(diff / 3600000);
        if (hrs > 24) return `${Math.floor(hrs / 24)}d trước`;
        if (hrs > 0) return `${hrs}h trước`;
        return `${Math.floor(diff / 60000)}p trước`;
    } catch (e) { return dateStr; }
}

function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.className = 'toast', 3000);
}
