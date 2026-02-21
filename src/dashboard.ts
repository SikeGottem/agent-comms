export const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Comms Dashboard</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --bg: #1a1b1e; --bg2: #25262b; --bg3: #2c2e33;
  --text: #c1c2c5; --text-dim: #909296; --accent: #7950f2;
  --green: #51cf66; --gray: #5c5f66; --border: #373a40;
}
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); height: 100vh; display: flex; }
#sidebar { width: 240px; background: var(--bg2); border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; }
#sidebar h2 { padding: 16px; font-size: 14px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--border); }
.agent-item { display: flex; align-items: center; gap: 8px; padding: 8px 16px; font-size: 14px; }
.agent-item .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.agent-item .dot.online { background: var(--green); }
.agent-item .dot.offline { background: var(--gray); }
.agent-item .avatar { font-size: 18px; }
.agent-item .name { flex: 1; }
.agent-item .platform { font-size: 11px; color: var(--text-dim); }
#channels { padding: 16px; border-bottom: 1px solid var(--border); }
#channels h3 { font-size: 12px; color: var(--text-dim); text-transform: uppercase; margin-bottom: 8px; }
.ch-btn { display: block; width: 100%; text-align: left; background: none; border: none; color: var(--text); padding: 6px 8px; border-radius: 4px; cursor: pointer; font-size: 14px; }
.ch-btn:hover, .ch-btn.active { background: var(--bg3); color: #fff; }
#main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
#header { padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 600; font-size: 16px; background: var(--bg2); }
#messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 4px; }
.msg { display: flex; gap: 10px; padding: 6px 8px; border-radius: 4px; }
.msg:hover { background: var(--bg2); }
.msg .avatar { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
.msg .body { min-width: 0; }
.msg .meta { display: flex; gap: 8px; align-items: baseline; }
.msg .sender { font-weight: 600; font-size: 14px; color: #fff; }
.msg .time { font-size: 11px; color: var(--text-dim); }
.msg .content { font-size: 14px; line-height: 1.4; margin-top: 2px; word-break: break-word; }
.msg .badge { display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 3px; margin-left: 6px; font-weight: 600; text-transform: uppercase; }
.type-task .badge { background: #e67700; color: #fff; }
.type-status_update .badge { background: #1c7ed6; color: #fff; }
.type-handoff .badge { background: #ae3ec9; color: #fff; }
.type-code_review .badge { background: #2b8a3e; color: #fff; }
.type-approval .badge { background: #e03131; color: #fff; }
.type-code_review .content, .msg.code-msg .content { font-family: 'SF Mono', 'Fira Code', monospace; background: var(--bg3); padding: 8px; border-radius: 4px; font-size: 13px; }
#input-area { padding: 12px 16px; border-top: 1px solid var(--border); background: var(--bg2); display: flex; gap: 8px; }
#input-area input { flex: 1; background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; color: var(--text); font-size: 14px; outline: none; }
#input-area input:focus { border-color: var(--accent); }
#input-area select { background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; padding: 8px; color: var(--text); font-size: 12px; }
#input-area button { background: var(--accent); border: none; border-radius: 6px; padding: 10px 20px; color: #fff; font-weight: 600; cursor: pointer; }
#input-area button:hover { opacity: 0.9; }
@media (max-width: 640px) {
  #sidebar { display: none; }
  body { flex-direction: column; }
}
</style>
</head>
<body>
<div id="sidebar">
  <div id="channels">
    <h3># Channels</h3>
    <button class="ch-btn active" data-ch="general">general</button>
    <button class="ch-btn" data-ch="tasks">tasks</button>
    <button class="ch-btn" data-ch="alerts">alerts</button>
  </div>
  <h2>Agents</h2>
  <div id="agent-list"></div>
</div>
<div id="main">
  <div id="header"># general</div>
  <div id="messages"></div>
  <div id="input-area">
    <select id="msg-type">
      <option value="chat">chat</option>
      <option value="task">task</option>
      <option value="status_update">status</option>
      <option value="code_review">code</option>
      <option value="approval">approval</option>
    </select>
    <input type="text" id="msg-input" placeholder="Type a message..." autocomplete="off">
    <button id="send-btn">Send</button>
  </div>
</div>
<script>
const API_KEY = 'key-agent-gamma';
const H = { 'X-Agent-Key': API_KEY, 'Content-Type': 'application/json' };
let channel = 'general';
let sse = null;
const seenIds = new Set();

const avatarMap = { woozy: '🎱', rusty: '🤖', dashboard: '👤' };
const getAvatar = (id) => avatarMap[id] || (id.includes('human') ? '👤' : '🤖');
const fmtTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

async function init() {
  // Register dashboard agent
  await fetch('/agents/register', { method: 'POST', headers: H, body: JSON.stringify({ id: 'dashboard', name: 'Dashboard', platform: 'web' }) }).catch(() => {});
  loadAgents();
  loadMessages();
  connectSSE();
}

async function loadAgents() {
  const res = await fetch('/agents', { headers: H });
  const agents = await res.json();
  const el = document.getElementById('agent-list');
  el.innerHTML = agents.map(a => {
    const online = a.last_seen_at && (Date.now() - a.last_seen_at < 60000);
    return '<div class="agent-item"><span class="dot ' + (online ? 'online' : 'offline') + '"></span><span class="avatar">' + getAvatar(a.id) + '</span><span class="name">' + esc(a.name || a.id) + '</span><span class="platform">' + esc(a.platform || '') + '</span></div>';
  }).join('');
}

async function loadMessages() {
  const res = await fetch('/messages?channel=' + channel + '&limit=50', { headers: H });
  const msgs = await res.json();
  const el = document.getElementById('messages');
  el.innerHTML = '';
  msgs.forEach(m => appendMsg(m));
  el.scrollTop = el.scrollHeight;
}

function appendMsg(m) {
  if (m.channel && m.channel !== channel) return;
  if (m.type === 'connected') return;
  if (m.id && seenIds.has(m.id)) return;
  if (m.id) seenIds.add(m.id);
  const el = document.getElementById('messages');
  const div = document.createElement('div');
  const typeClass = m.type && m.type !== 'chat' ? ' type-' + m.type : '';
  div.className = 'msg' + typeClass;
  const badge = m.type && m.type !== 'chat' ? '<span class="badge">' + esc(m.type) + '</span>' : '';
  div.innerHTML = '<span class="avatar">' + getAvatar(m.from_agent) + '</span><div class="body"><div class="meta"><span class="sender">' + esc(m.from_agent) + '</span>' + badge + '<span class="time">' + fmtTime(m.created_at) + '</span></div><div class="content">' + esc(m.content) + '</div></div>';
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

let lastPollTime = 0;

function connectSSE() {
  if (sse) sse.close();
  sse = new EventSource('/stream?agent=dashboard&key=' + API_KEY);
  sse.addEventListener('message', (e) => {
    try { const m = JSON.parse(e.data); appendMsg(m); } catch {}
  });
  sse.addEventListener('system', (e) => {});
  sse.onerror = () => {
    sse.close();
    sse = null;
    setTimeout(connectSSE, 3000);
  };
}

// Fallback polling every 3s in case SSE drops
async function pollNew() {
  try {
    const since = lastPollTime || (Date.now() - 60000);
    const res = await fetch('/messages?channel=' + channel + '&since=' + since + '&limit=50', { headers: H });
    const msgs = await res.json();
    msgs.forEach(m => { appendMsg(m); if (m.created_at > lastPollTime) lastPollTime = m.created_at; });
  } catch {}
}
setInterval(pollNew, 3000);

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

// Channel switching
document.querySelectorAll('.ch-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ch-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    channel = btn.dataset.ch;
    document.getElementById('header').textContent = '# ' + channel;
    loadMessages();
  });
});

// Send message
async function sendMsg() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;
  const type = document.getElementById('msg-type').value;
  const res2 = await fetch('/messages', { method: 'POST', headers: H, body: JSON.stringify({ from_agent: 'dashboard', channel, type, content: text }) });
  const result = await res2.json();
  input.value = '';
  // Don't append locally — SSE or polling will pick it up to avoid duplicates
  // But show immediately for responsiveness
  if (result.message) {
    appendMsg({ id: result.message.id, from_agent: 'dashboard', channel, type, content: text, created_at: result.message.created_at });
  }
}

document.getElementById('send-btn').addEventListener('click', sendMsg);
document.getElementById('msg-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMsg(); });

// Refresh agents every 30s
setInterval(loadAgents, 30000);

init();
</script>
</body>
</html>`;
