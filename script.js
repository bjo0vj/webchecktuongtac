// ========== CONFIG ==========
const API_URL = window.location.origin;

// ========== STATE ==========
let currentGroupId = null;
let groupsData = {};
let membersData = {};
let pingInterval = null;

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function () {
    const userCode = localStorage.getItem('userCode');
    const userPass = localStorage.getItem('userPass');

    if (!userCode || !userPass) {
        window.location.href = 'index.html';
        return;
    }

    const userCodeEl = document.getElementById('userCode');
    if (userCodeEl) {
        userCodeEl.textContent = `Code: ${userCode}`;
    }

    loadData();

    // Ping mỗi 5 phút để giữ kết nối
    startPingInterval();
});

// ========== PING INTERVAL ==========
function startPingInterval() {
    if (pingInterval) clearInterval(pingInterval);

    pingInterval = setInterval(async () => {
        const userCode = localStorage.getItem('userCode');
        if (!userCode) return;

        try {
            await fetch(`${API_URL}/api/ping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: userCode })
            });
            console.log('[PING] Keep-alive sent');
        } catch (e) {
            console.log('[PING] Failed');
        }
    }, 5 * 60 * 1000); // 5 phút
}

// ========== LOGOUT ==========
function logout() {
    const userCode = localStorage.getItem('userCode');

    // Thông báo server ngừng kết nối
    if (userCode) {
        fetch(`${API_URL}/api/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: userCode })
        }).catch(() => { });
    }

    if (pingInterval) clearInterval(pingInterval);

    localStorage.removeItem('userCode');
    localStorage.removeItem('userPass');
    window.location.href = 'index.html';
}

// ========== LOAD DATA ==========
async function loadData() {
    const userCode = localStorage.getItem('userCode');

    try {
        const refreshRes = await fetch(`${API_URL}/api/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: userCode })
        });
        const refreshData = await refreshRes.json();

        if (refreshData.success) {
            groupsData = refreshData.groups || {};
            membersData = refreshData.members || {};
            renderGroups();

            if (currentGroupId && groupsData[currentGroupId]) {
                renderMembers(currentGroupId);
            }
            return;
        }
    } catch (e) {
        console.log('Refresh failed:', e);
    }

    // Fallback
    try {
        const response = await fetch(`${API_URL}/api/groups?code=${userCode}`);
        const data = await response.json();

        if (data.success) {
            groupsData = data.groups || {};
            renderGroups();
        }
    } catch (error) {
        showToast('Không thể kết nối', 'error');
    }
}

// ========== RENDER GROUPS ==========
function renderGroups() {
    const groupList = document.getElementById('groupList');

    if (Object.keys(groupsData).length === 0) {
        groupList.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px;">
                <span class="icon">📭</span>
                <p>Chưa có nhóm</p>
            </div>
        `;
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

    if (membersData[groupId]) {
        renderMembers(groupId);
    } else {
        await loadMembers(groupId);
    }
}

// ========== LOAD MEMBERS ==========
async function loadMembers(groupId) {
    const container = document.getElementById('membersContainer');
    container.innerHTML = '<div class="loading-box">⏳ Đang tải...</div>';

    try {
        const userCode = localStorage.getItem('userCode');
        const response = await fetch(`${API_URL}/api/members?code=${userCode}&groupId=${groupId}`);
        const data = await response.json();

        if (data.success) {
            membersData[groupId] = data.members || [];
            renderMembers(groupId);
        }
    } catch (error) {
        container.innerHTML = '<div class="empty-state"><p>Lỗi tải dữ liệu</p></div>';
    }
}

// ========== RENDER MEMBERS ==========
function renderMembers(groupId) {
    const container = document.getElementById('membersContainer');
    const members = membersData[groupId] || [];

    if (members.length === 0) {
        container.innerHTML = '<div class="empty-state"><span class="icon">👥</span><p>Chưa có thành viên</p></div>';
        return;
    }

    members.sort((a, b) => (b.day || 0) - (a.day || 0));

    let html = '';
    members.forEach((member, index) => {
        const lastActive = getTimeAgo(member.lastInteract);
        html += `
            <div class="member-card">
                <div class="member-header">
                    <div class="member-name">${member.name || 'User'}</div>
                    <div class="member-rank">#${index + 1}</div>
                </div>
                <div class="member-stats">
                    <div class="stat-item"><div class="stat-value">${member.day || 0}</div><div class="stat-label">Ngày</div></div>
                    <div class="stat-item"><div class="stat-value">${member.week || 0}</div><div class="stat-label">Tuần</div></div>
                    <div class="stat-item"><div class="stat-value">${member.total || 0}</div><div class="stat-label">Tổng</div></div>
                </div>
                <div class="member-last-active">🕐 ${lastActive}</div>
                <div class="member-actions">
                    <button class="btn-kick" onclick="kickMember('${groupId}', '${member.id}', '${member.name}')">🚫 Kick</button>
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
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '⏳...';

    try {
        const response = await fetch(`${API_URL}/api/kick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: userCode, groupId, memberId, memberName })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`✅ Đã kick ${memberName}`, 'success');
            membersData[groupId] = membersData[groupId].filter(m => m.id !== memberId);
            renderMembers(groupId);
        } else {
            showToast(`❌ ${data.message}`, 'error');
            btn.disabled = false;
            btn.textContent = '🚫 Kick';
        }
    } catch (error) {
        showToast('❌ Lỗi', 'error');
        btn.disabled = false;
        btn.textContent = '🚫 Kick';
    }
}

// ========== LOAD GROUP DATA ==========
async function loadGroupData() {
    if (!currentGroupId) return;

    showToast('⏳ Đang sync...', 'success');

    try {
        const userCode = localStorage.getItem('userCode');
        const response = await fetch(`${API_URL}/api/loaddata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: userCode, groupId: currentGroupId })
        });

        const data = await response.json();

        if (data.success && data.members) {
            membersData[currentGroupId] = data.members;
            renderMembers(currentGroupId);
            showToast('✅ Sync xong', 'success');
        } else {
            showToast(`❌ ${data.message}`, 'error');
        }
    } catch (error) {
        showToast('❌ Bot offline', 'error');
    }
}

// ========== UTILS ==========
function getTimeAgo(dateStr) {
    if (!dateStr || dateStr === '-') return 'Chưa có';
    try {
        const parts = dateStr.split(' ');
        const timeParts = parts[0].split(':');
        const dateParts = parts[1].split('/');
        const date = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]), parseInt(timeParts[0]), parseInt(timeParts[1]), parseInt(timeParts[2]));
        const diff = Date.now() - date;
        const hours = Math.floor(diff / 3600000);
        if (hours > 24) return `${Math.floor(hours / 24)} ngày trước`;
        if (hours > 0) return `${hours}h trước`;
        return `${Math.floor(diff / 60000)} phút trước`;
    } catch (e) {
        return dateStr;
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => { toast.className = 'toast'; }, 3000);
}
