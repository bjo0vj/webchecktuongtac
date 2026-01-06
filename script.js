const API = '';
let currentGroup = null, groups = {}, members = {};

document.addEventListener('DOMContentLoaded', () => {
    const code = localStorage.getItem('userCode');
    if (!code) { window.location.href = 'index.html'; return; }
    document.getElementById('userCode').textContent = `Code: ${code}`;
    loadData();
    checkStatus();
    setInterval(loadData, 10000);
    setInterval(checkStatus, 10000);
});

async function checkStatus() {
    const code = localStorage.getItem('userCode');
    try {
        const res = await fetch(`${API}/api/status?code=${code}`);
        const data = await res.json();
        document.getElementById('botStatus').innerHTML = data.connected
            ? '<span style="color:#10b981">🟢 Bot Online</span>'
            : '<span style="color:#ef4444">🔴 Bot Offline</span>';
    } catch (e) { }
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

async function loadData() {
    const code = localStorage.getItem('userCode');
    try {
        const res = await fetch(`${API}/api/groups?code=${code}`);
        const data = await res.json();
        if (data.success) { groups = data.groups || {}; renderGroups(); }
    } catch (e) { showToast('Lỗi', 'error'); }
}

function renderGroups() {
    const el = document.getElementById('groupList');
    if (!Object.keys(groups).length) {
        el.innerHTML = '<div class="empty-state" style="padding:20px"><p>Chờ bot sync...</p></div>';
        return;
    }
    el.innerHTML = Object.entries(groups).map(([id, g]) => `
        <div class="group-item ${id === currentGroup ? 'active' : ''}" onclick="selectGroup('${id}')">
            <div class="group-name">${g.name || id}</div>
            <div class="group-meta">👥 ${g.memberCount || 0}</div>
        </div>
    `).join('');
}

async function selectGroup(id) {
    currentGroup = id;
    document.getElementById('currentGroupName').textContent = groups[id]?.name || id;
    document.getElementById('actionButtons').style.display = 'flex';
    renderGroups();
    await loadMembers(id);
}

async function loadMembers(id) {
    const el = document.getElementById('membersContainer');
    el.innerHTML = '<div class="loading-box">⏳</div>';
    try {
        const code = localStorage.getItem('userCode');
        const res = await fetch(`${API}/api/members?code=${code}&groupId=${id}`);
        const data = await res.json();
        if (data.success) { members[id] = data.members || []; renderMembers(id); }
    } catch (e) { el.innerHTML = '<div class="empty-state"><p>Lỗi</p></div>'; }
}

function renderMembers(id) {
    const el = document.getElementById('membersContainer');
    const list = (members[id] || []).sort((a, b) => (b.day || 0) - (a.day || 0));
    if (!list.length) { el.innerHTML = '<div class="empty-state"><p>Chưa có data</p></div>'; return; }
    el.innerHTML = list.map((m, i) => `
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
            <div class="member-last-active">🕐 ${timeAgo(m.lastInteract)}</div>
            <div class="member-actions">
                <button class="btn-kick" onclick="kick('${id}','${m.id}','${m.name}')">🚫 Kick</button>
            </div>
        </div>
    `).join('');
}

async function kick(gid, mid, name) {
    if (!confirm(`Kick "${name}"?`)) return;
    try {
        const code = localStorage.getItem('userCode');
        const res = await fetch(`${API}/api/kick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, groupId: gid, memberId: mid, memberName: name })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`✅ ${data.message}`, 'success');
            members[gid] = members[gid].filter(m => m.id !== mid);
            renderMembers(gid);
        }
    } catch (e) { showToast('Lỗi', 'error'); }
}

async function forceSync() {
    if (!currentGroup) return;
    const code = localStorage.getItem('userCode');
    showToast('⏳ Đang sync...', 'info');
    try {
        await fetch(`${API}/api/forceSync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, groupId: currentGroup })
        });
        // Reload data after short delay
        setTimeout(async () => {
            await loadData();
            await loadMembers(currentGroup);
            showToast('✅ Đã sync xong!', 'success');
        }, 2000);
    } catch (e) {
        showToast('❌ Lỗi sync', 'error');
    }
}

async function clearGroupTime() {
    if (!currentGroup) return;
    if (!confirm('Xóa dữ liệu tương tác ngày/tuần của nhóm này? (Reset về 0)')) return;
    const code = localStorage.getItem('userCode');
    showToast('⏳ Đang xóa...', 'info');
    try {
        await fetch(`${API}/api/clearTime`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, groupId: currentGroup })
        });
        setTimeout(async () => {
            await loadData();
            await loadMembers(currentGroup);
            showToast('✅ Đã reset dữ liệu!', 'success');
        }, 2000);
    } catch (e) {
        showToast('❌ Lỗi', 'error');
    }
}

function timeAgo(s) {
    if (!s || s === '-') return '-';
    try {
        const [t, d] = s.split(' ');
        const [h, m] = t.split(':');
        const [day, mo, y] = d.split('/');
        const diff = Date.now() - new Date(y, mo - 1, day, h, m);
        const hrs = Math.floor(diff / 3600000);
        if (hrs > 24) return `${Math.floor(hrs / 24)}d`;
        if (hrs > 0) return `${hrs}h`;
        return `${Math.floor(diff / 60000)}p`;
    } catch (e) { return s; }
}

function showToast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast show ${type}`;
    setTimeout(() => el.className = 'toast', 3000);
}
