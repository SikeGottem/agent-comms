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
  --red: #e03131; --orange: #e67700; --blue: #1c7ed6; --purple: #ae3ec9;
  --yellow: #fcc419;
}
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); height: 100vh; display: flex; overflow: hidden; }

/* Sidebar */
#sidebar { width: 260px; background: var(--bg2); border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; overflow-y: auto; }
#sidebar h2 { padding: 16px; font-size: 14px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--border); }
.agent-item { display: flex; align-items: center; gap: 8px; padding: 8px 16px; font-size: 14px; flex-wrap: wrap; }
.agent-item .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.agent-item .dot.online { background: var(--green); }
.agent-item .dot.possibly_offline { background: var(--yellow); }
.agent-item .dot.offline { background: var(--gray); }
.agent-item .avatar { font-size: 18px; }
.agent-item .name { flex: 1; }
.agent-item .platform { font-size: 11px; color: var(--text-dim); }
.agent-item .load-badge { font-size: 10px; background: var(--bg3); border: 1px solid var(--border); border-radius: 10px; padding: 1px 6px; color: var(--text-dim); }
.cap-badges { display: flex; gap: 3px; flex-wrap: wrap; width: 100%; padding-left: 34px; margin-top: 2px; }
.cap-badge { font-size: 9px; background: var(--accent); color: #fff; border-radius: 3px; padding: 1px 5px; opacity: 0.8; }
#channels { padding: 16px; border-bottom: 1px solid var(--border); }
#channels h3 { font-size: 12px; color: var(--text-dim); text-transform: uppercase; margin-bottom: 8px; }
.ch-btn { display: block; width: 100%; text-align: left; background: none; border: none; color: var(--text); padding: 6px 8px; border-radius: 4px; cursor: pointer; font-size: 14px; }
.ch-btn:hover, .ch-btn.active { background: var(--bg3); color: #fff; }

#hamburger { display: none; position: fixed; top: 8px; left: 8px; z-index: 100; background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; color: var(--text); font-size: 20px; cursor: pointer; }

/* Main */
#main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
#header { padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 600; font-size: 16px; background: var(--bg2); display: flex; align-items: center; gap: 12px; }
#header .title { flex: 1; }
#header button { background: var(--bg3); border: 1px solid var(--border); border-radius: 4px; padding: 4px 10px; color: var(--text); cursor: pointer; font-size: 12px; }
#header button:hover { background: var(--accent); color: #fff; }

/* Topic bar */
#topic-bar { padding: 6px 16px; background: var(--bg3); border-bottom: 1px solid var(--border); font-size: 12px; color: var(--text-dim); display: none; }
#topic-bar.show { display: block; }
#member-bar.show { display: block !important; }
#topic-bar .topic-text { color: var(--text); }

#search-bar { padding: 8px 16px; border-bottom: 1px solid var(--border); background: var(--bg2); display: none; }
#search-bar input { width: 100%; background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; color: var(--text); font-size: 14px; outline: none; }
#search-bar input:focus { border-color: var(--accent); }
#search-bar.show { display: block; }

#pinned-area { border-bottom: 1px solid var(--border); background: var(--bg2); max-height: 120px; overflow-y: auto; display: none; }
#pinned-area.show { display: block; }
#pinned-area .pinned-msg { padding: 6px 16px; font-size: 13px; display: flex; gap: 8px; color: var(--text-dim); }
#pinned-area .pinned-msg .pin-icon { color: var(--accent); }
#pinned-area .pinned-label { padding: 4px 16px; font-size: 11px; color: var(--accent); text-transform: uppercase; font-weight: 600; }

#summary-modal { display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--bg2); border: 1px solid var(--border); border-radius: 8px; padding: 20px; width: 500px; max-width: 90vw; max-height: 80vh; overflow-y: auto; z-index: 200; }
#summary-modal h3 { margin-bottom: 12px; }
#summary-modal .summary-msg { padding: 4px 0; font-size: 13px; border-bottom: 1px solid var(--border); }
#summary-modal .close-btn { position: absolute; top: 8px; right: 12px; background: none; border: none; color: var(--text); font-size: 18px; cursor: pointer; }
#overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 199; }

/* Messages */
#messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 4px; }
.msg { display: flex; gap: 10px; padding: 6px 8px; border-radius: 4px; position: relative; }
.msg:hover { background: var(--bg2); }
.msg:hover .msg-actions { display: flex; }
.msg .avatar { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
.msg .body { min-width: 0; flex: 1; }
.msg .meta { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.msg .sender { font-weight: 600; font-size: 14px; color: #fff; }
.msg .time { font-size: 11px; color: var(--text-dim); cursor: help; }
.msg .content { font-size: 14px; line-height: 1.4; margin-top: 2px; word-break: break-word; }
.msg .badge { display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 3px; margin-left: 6px; font-weight: 600; text-transform: uppercase; }
.msg .receipt { font-size: 11px; margin-left: 4px; }
.msg .receipt.sent { color: var(--gray); }
.msg .receipt.read { color: var(--blue); }
.msg .priority-indicator { font-size: 10px; margin-left: 4px; }

.msg-actions { display: none; position: absolute; top: 4px; right: 8px; gap: 4px; }
.msg-actions button { background: var(--bg3); border: 1px solid var(--border); border-radius: 3px; padding: 2px 6px; color: var(--text-dim); cursor: pointer; font-size: 11px; }
.msg-actions button:hover { color: #fff; border-color: var(--accent); }

.msg.reply { margin-left: 40px; border-left: 2px solid var(--accent); padding-left: 12px; }
.msg .reply-ref { font-size: 11px; color: var(--accent); margin-bottom: 2px; cursor: pointer; }

/* Priority styling */
.msg.priority-urgent { border-left: 3px solid var(--red); background: rgba(224,49,49,0.08); }
.msg.priority-high { border-left: 3px solid var(--orange); }

/* Message type badges */
.type-task .badge { background: var(--orange); color: #fff; }
.type-status_update .badge { background: var(--blue); color: #fff; }
.type-handoff .badge { background: var(--purple); color: #fff; }
.type-code_review .badge { background: #2b8a3e; color: #fff; }
.type-approval .badge { background: var(--red); color: #fff; }
.type-request .badge { background: #1098ad; color: #fff; }
.type-response .badge { background: #37b24d; color: #fff; }
.type-broadcast .badge { background: var(--purple); color: #fff; }
.type-heartbeat .badge { background: var(--green); color: #fff; }
.type-coordination .badge { background: var(--yellow); color: #000; }
.type-delegation .badge { background: var(--blue); color: #fff; }

/* Delegation panel */
.deleg-item { padding: 8px 16px; border-bottom: 1px solid var(--border); font-size: 12px; }
.deleg-item .deleg-label { font-weight: 600; color: #fff; }
.deleg-item .deleg-task { color: var(--text-dim); margin-top: 2px; }
.deleg-status { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
.deleg-status.running { background: var(--blue); color: #fff; }
.deleg-status.completed { background: var(--green); color: #fff; }
.deleg-status.failed { background: var(--red); color: #fff; }
.task-delegations { margin-top: 8px; padding: 6px 0; }
.task-delegations .deleg-line { font-size: 11px; padding: 2px 0; }

pre.code-block { background: var(--bg3); padding: 10px; border-radius: 6px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px; overflow-x: auto; margin-top: 4px; border: 1px solid var(--border); }
pre.code-block code { color: #e1e1e1; }
.code-lang { font-size: 10px; color: var(--accent); text-transform: uppercase; margin-bottom: 2px; }

.handoff-card { background: var(--bg3); border: 1px solid var(--purple); border-radius: 8px; padding: 12px; margin-top: 6px; }
.handoff-card h4 { color: var(--purple); margin-bottom: 6px; font-size: 13px; }
.handoff-card .field { font-size: 12px; margin: 2px 0; }
.handoff-card .field label { color: var(--text-dim); }

.mention { color: var(--accent); font-weight: 700; }

#typing-indicator { padding: 4px 16px; font-size: 12px; color: var(--text-dim); font-style: italic; min-height: 20px; }

#reply-indicator { padding: 6px 16px; background: var(--bg3); border-top: 1px solid var(--accent); display: none; font-size: 12px; color: var(--text-dim); }
#reply-indicator.show { display: flex; align-items: center; gap: 8px; }
#reply-indicator .cancel-reply { background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 16px; }

#input-area { padding: 12px 16px; border-top: 1px solid var(--border); background: var(--bg2); display: flex; gap: 8px; flex-wrap: wrap; }
#input-area input { flex: 1; min-width: 200px; background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; color: var(--text); font-size: 14px; outline: none; }
#input-area input:focus { border-color: var(--accent); }
#input-area select { background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; padding: 8px; color: var(--text); font-size: 12px; }
#input-area button { background: var(--accent); border: none; border-radius: 6px; padding: 10px 20px; color: #fff; font-weight: 600; cursor: pointer; }
#input-area button:hover { opacity: 0.9; }

/* Task panel */
#task-panel { width: 320px; background: var(--bg2); border-left: 1px solid var(--border); display: none; flex-direction: column; overflow-y: auto; flex-shrink: 0; }
#task-panel.show { display: flex; }
#task-panel h3 { padding: 12px 16px; font-size: 14px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
#task-panel h3 button { background: var(--accent); border: none; border-radius: 4px; padding: 4px 8px; color: #fff; cursor: pointer; font-size: 11px; }
.task-item { padding: 10px 16px; border-bottom: 1px solid var(--border); cursor: pointer; }
.task-item:hover { background: var(--bg3); }
.task-item .task-title { font-size: 13px; font-weight: 600; color: #fff; }
.task-item .task-meta { font-size: 11px; color: var(--text-dim); margin-top: 4px; }
.task-item .task-deps { font-size: 10px; color: var(--yellow); margin-top: 2px; }
.task-item .task-deadline { font-size: 10px; color: var(--orange); margin-top: 2px; }
.task-status { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
.task-status.pending { background: var(--gray); color: #fff; }
.task-status.in_progress { background: var(--blue); color: #fff; }
.task-status.done { background: var(--green); color: #fff; }
.task-status.blocked { background: var(--red); color: #fff; }
.task-status.archived { background: #495057; color: #adb5bd; }
.task-item.stale { border-left: 3px solid var(--orange); background: rgba(230, 119, 0, 0.08); }
.task-item.stale .task-title::before { content: ''; display: inline-block; width: 8px; height: 8px; background: var(--orange); border-radius: 50%; margin-right: 6px; animation: pulse-dot 1.5s infinite; }
@keyframes pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
.task-item.unclaimed { border-left: 3px solid var(--accent); }
.task-claimed-by { font-size: 10px; color: var(--accent); margin-top: 2px; }
.task-item .task-done-check { color: var(--green); font-weight: bold; }
.task-priority { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; margin-left: 4px; }
.task-priority.urgent { background: var(--red); color: #fff; }
.task-priority.high { background: var(--orange); color: #fff; }
.task-priority.medium { background: var(--blue); color: #fff; }
.task-priority.low { background: var(--gray); color: #fff; }

#task-form { display: none; padding: 12px 16px; border-bottom: 1px solid var(--border); }
#task-form.show { display: block; }
#task-form input, #task-form select, #task-form textarea { width: 100%; background: var(--bg3); border: 1px solid var(--border); border-radius: 4px; padding: 6px 8px; color: var(--text); font-size: 12px; margin-bottom: 6px; font-family: inherit; }
#task-form textarea { resize: vertical; min-height: 40px; }
#task-form button { background: var(--accent); border: none; border-radius: 4px; padding: 6px 12px; color: #fff; cursor: pointer; font-size: 12px; width: 100%; }

/* Task filter tabs */
.task-filters { display: flex; gap: 4px; padding: 8px 16px; border-bottom: 1px solid var(--border); }
.task-filter-btn { background: none; border: 1px solid var(--border); border-radius: 4px; padding: 3px 8px; color: var(--text-dim); cursor: pointer; font-size: 11px; }
.task-filter-btn:hover, .task-filter-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

#memory-panel { border-top: 1px solid var(--border); }
#memory-panel h3 { padding: 8px 16px; font-size: 12px; color: var(--text-dim); text-transform: uppercase; cursor: pointer; }
#memory-panel h3:hover { color: #fff; }
#memory-entries { display: none; max-height: 200px; overflow-y: auto; }
#memory-entries.show { display: block; }
.mem-item { padding: 4px 16px; font-size: 12px; display: flex; gap: 8px; border-bottom: 1px solid var(--border); }
.mem-item .mem-key { color: var(--accent); font-weight: 600; min-width: 80px; }
.mem-item .mem-val { flex: 1; word-break: break-word; }
.mem-item .mem-by { color: var(--text-dim); font-size: 10px; }

@media (max-width: 768px) {
  #sidebar { position: fixed; left: -280px; top: 0; bottom: 0; z-index: 50; transition: left 0.2s; }
  #sidebar.open { left: 0; }
  #hamburger { display: block; }
  #header { padding-left: 48px; }
  #task-panel { display: none !important; }
}
</style>
</head>
<body>
<button id="hamburger">☰</button>
<div id="sidebar">
  <div id="channels">
    <h3># Channels</h3>
    <button class="ch-btn active" data-ch="general">general</button>
    <button class="ch-btn" data-ch="tasks">tasks</button>
    <button class="ch-btn" data-ch="alerts">alerts</button>
    <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
      <button class="ch-btn" onclick="showCreatePrivateChannel()" style="color:var(--accent);font-size:12px">🔒 + Private Channel</button>
    </div>
  </div>
  <h2>Agents</h2>
  <div id="agent-list"></div>
  <div class="sidebar-section" id="workflow-panel">
    <h3 onclick="toggleWorkflows()">⚡ Workflows ▸</h3>
    <div id="workflow-list" style="display:none"></div>
  </div>
  <div class="sidebar-section" id="delegation-panel">
    <h3 onclick="toggleDelegations()">🤖 Active Delegations ▸</h3>
    <div id="delegation-list" style="display:none"></div>
  </div>
  <div id="memory-panel">
    <h3 onclick="toggleMemory()">🧠 Shared Memory ▸</h3>
    <div id="memory-entries"></div>
  </div>
</div>
<div id="main">
  <div id="header">
    <span class="title"># general</span>
    <button onclick="toggleSearch()">🔍</button>
    <button onclick="showSummary()">📋 Summary</button>
    <button onclick="toggleTasks()">📝 Tasks</button>
  </div>
  <div id="topic-bar">📌 <span class="topic-text" id="topic-text"></span></div>
  <div id="member-bar" class="member-bar" style="padding:4px 16px;background:var(--bg3);border-bottom:1px solid var(--border);font-size:11px;color:var(--text-dim);display:none"></div>
  <div id="search-bar"><input type="text" id="search-input" placeholder="Search messages..." oninput="searchMessages()"></div>
  <div id="pinned-area"><div class="pinned-label">📌 Pinned</div><div id="pinned-list"></div></div>
  <div id="messages"></div>
  <div id="typing-indicator"></div>
  <div id="reply-indicator"><span>↩ Replying to <b id="reply-to-name"></b></span><button class="cancel-reply" onclick="cancelReply()">✕</button></div>
  <div id="input-area">
    <select id="msg-type">
      <option value="chat">chat</option>
      <option value="task">task</option>
      <option value="status_update">status</option>
      <option value="code_review">code</option>
      <option value="handoff">handoff</option>
      <option value="approval">approval</option>
      <option value="request">request</option>
      <option value="response">response</option>
      <option value="broadcast">broadcast</option>
      <option value="heartbeat">heartbeat</option>
      <option value="coordination">coordination</option>
      <option value="delegation">delegation</option>
    </select>
    <select id="msg-priority">
      <option value="normal">normal</option>
      <option value="low">low</option>
      <option value="high">high</option>
      <option value="urgent">🔴 urgent</option>
    </select>
    <input type="text" id="msg-input" placeholder="Type a message..." autocomplete="off">
    <button id="send-btn">Send</button>
  </div>
</div>
<div id="task-panel">
  <h3>📝 Tasks <button onclick="toggleTaskForm()">+ New</button></h3>
  <div class="task-filters">
    <button class="task-filter-btn active" data-filter="all" onclick="filterTasks('all',this)">All</button>
    <button class="task-filter-btn" data-filter="ready" onclick="filterTasks('ready',this)">Ready</button>
    <button class="task-filter-btn" data-filter="blocked" onclick="filterTasks('blocked',this)">Blocked</button>
    <button class="task-filter-btn" data-filter="archived" onclick="filterTasks('archived',this)">📦 Archived</button>
  </div>
  <div id="task-form">
    <input type="text" id="task-title" placeholder="Task title">
    <textarea id="task-desc" placeholder="Description (optional)"></textarea>
    <input type="text" id="task-assign" placeholder="Assign to (agent id)">
    <input type="text" id="task-deps" placeholder="Depends on (task IDs, comma-separated)">
    <input type="number" id="task-deadline" placeholder="Deadline (timestamp, optional)">
    <select id="task-priority"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select>
    <button onclick="createTask()">Create Task</button>
  </div>
  <div id="task-list"></div>
</div>
<div id="overlay" onclick="closeSummary()"></div>
<div id="summary-modal"><button class="close-btn" onclick="closeSummary()">✕</button><h3>Channel Summary</h3><div id="summary-content"></div></div>
<script>
const API_KEY = 'key-agent-gamma';
const H = { 'X-Agent-Key': API_KEY, 'Content-Type': 'application/json' };
let channel = 'general';
let sse = null;
const seenIds = new Set();
let replyTo = null;
let taskFilter = 'all';
const msgCache = new Map();

let myName = localStorage.getItem('agent-comms-name');
if (!myName) {
  myName = prompt('What\\'s your name?') || 'Anonymous';
  localStorage.setItem('agent-comms-name', myName);
}
const myId = 'human-' + myName.toLowerCase().replace(/[^a-z0-9]/g, '');

const avatarMap = { woozy: '🎱', rusty: '🤖', system: '⚙️' };
const getAvatar = (id) => avatarMap[id] || (id.startsWith('human') ? '👤' : '🤖');

function relativeTime(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}
function fullTime(ts) { return new Date(ts).toLocaleString(); }

let audioCtx = null;
function playBeep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } catch {}
}

function playUrgentBeep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    [800, 1000, 800].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.15;
      osc.start(audioCtx.currentTime + i * 0.15);
      osc.stop(audioCtx.currentTime + i * 0.15 + 0.1);
    });
  } catch {}
}

function formatContent(content) {
  let html = esc(content);
  html = html.replace(/\\\`\\\`\\\`(\\w*?)\\n([\\s\\S]*?)\\\`\\\`\\\`/g, function(_, lang, code) {
    const langLabel = lang ? '<div class="code-lang">' + lang + '</div>' : '';
    return langLabel + '<pre class="code-block"><code>' + code + '</code></pre>';
  });
  html = html.replace(/\\\`([^\\\`]+)\\\`/g, '<code style="background:var(--bg3);padding:1px 4px;border-radius:3px;font-size:13px;">$1</code>');
  html = html.replace(/@([a-zA-Z0-9_-]+)/g, '<span class="mention">@$1</span>');
  html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
  return html;
}

async function init() {
  await fetch('/agents/register', { method: 'POST', headers: H, body: JSON.stringify({ id: myId, name: myName, platform: 'web' }) }).catch(() => {});
  loadAgents();
  loadMessages();
  connectSSE();
  loadTasks();
  loadMemory();
  loadChannelTopic();
  loadChannels();
  loadChannelMembers();
  document.getElementById('header').querySelector('.title').textContent = '# ' + channel + '  —  ' + myName;
}

// Load channels dynamically including private ones
async function loadChannels() {
  try {
    const res = await fetch('/channels?agent=' + myId, { headers: H });
    const chs = await res.json();
    const container = document.getElementById('channels');
    const btns = container.querySelectorAll('.ch-btn[data-ch]');
    const existing = new Set();
    btns.forEach(b => existing.add(b.dataset.ch));
    chs.forEach(ch => {
      if (!existing.has(ch.id)) {
        const btn = document.createElement('button');
        btn.className = 'ch-btn';
        btn.dataset.ch = ch.id;
        btn.textContent = (ch.is_private ? '🔒 ' : '') + ch.id;
        btn.addEventListener('click', () => switchChannel(ch.id, btn));
        // Insert before the private channel button div
        const privDiv = container.querySelector('div');
        container.insertBefore(btn, privDiv);
      } else if (ch.is_private) {
        // Update existing to show lock
        btns.forEach(b => { if (b.dataset.ch === ch.id && !b.textContent.includes('🔒')) b.textContent = '🔒 ' + ch.id; });
      }
    });
  } catch {}
}

function switchChannel(ch, btn) {
  document.querySelectorAll('.ch-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  channel = ch;
  document.getElementById('header').querySelector('.title').textContent = '# ' + channel + '  —  ' + myName;
  loadMessages();
  loadTasks();
  loadChannelTopic();
  loadChannelMembers();
}

async function loadChannelMembers() {
  const memberArea = document.getElementById('member-bar');
  try {
    const chRes = await fetch('/channels/' + channel + '/summary', { headers: H });
    const chData = await chRes.json();
    if (!chData.is_private) { memberArea.classList.remove('show'); return; }
    const res = await fetch('/channels/' + channel + '/members', { headers: H });
    const members = await res.json();
    const roleIcon = { owner: '👑', admin: '⭐', member: '' };
    memberArea.innerHTML = '🔒 Members: ' + members.map(m => (roleIcon[m.role] || '') + m.agent_id).join(', ');
    memberArea.classList.add('show');
  } catch { memberArea.classList.remove('show'); }
}

function showCreatePrivateChannel() {
  const name = prompt('Private channel name (e.g. secret-ops):');
  if (!name) return;
  const agents = prompt('Invite agents (comma-separated IDs, e.g. woozy,rusty):');
  const allowed = agents ? agents.split(',').map(s => s.trim()).filter(Boolean) : [];
  fetch('/channels', { method: 'POST', headers: H, body: JSON.stringify({
    id: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    name: name,
    is_private: true,
    created_by: myId,
    allowed_agents: allowed,
  })}).then(r => r.json()).then(data => {
    if (data.invite_code) alert('Channel created! Invite code: ' + data.invite_code);
    loadChannels();
  }).catch(e => alert('Error: ' + e));
}

async function loadChannelTopic() {
  try {
    const res = await fetch('/channels/' + channel + '/summary', { headers: H });
    const data = await res.json();
    const topicBar = document.getElementById('topic-bar');
    if (data.topic) {
      document.getElementById('topic-text').textContent = data.topic;
      topicBar.classList.add('show');
    } else {
      topicBar.classList.remove('show');
    }
  } catch {}
}

async function loadAgents() {
  const [agentsRes, presenceRes] = await Promise.all([
    fetch('/agents', { headers: H }),
    fetch('/presence', { headers: H }).catch(() => ({ json: () => [] })),
  ]);
  const agents = await agentsRes.json();
  const presenceList = await presenceRes.json();
  const presenceMap = {};
  (Array.isArray(presenceList) ? presenceList : []).forEach(p => { presenceMap[p.agent_id] = p; });

  const el = document.getElementById('agent-list');
  el.innerHTML = agents.map(a => {
    const p = presenceMap[a.id];
    const status = p ? (p.effective_status || p.status || 'offline') : (a.status || (a.online ? 'online' : 'offline'));
    const statusText = p && p.status_text ? ' · ' + esc(p.status_text) : '';
    const mood = p && p.mood ? ' ' + esc(p.mood) : '';
    const taskBadge = a.current_load > 0 ? '<span class="task-badge">' + a.current_load + '</span>' : '';
    return '<div class="agent-item"><span class="dot ' + esc(status) + '"></span><span class="avatar">' + getAvatar(a.id) + mood + '</span><span class="name">' + esc(a.name || a.id) + '<span style="font-size:10px;color:var(--text-dim)">' + statusText + '</span></span>' + taskBadge + '</div>';
  }).join('');
}

async function loadMessages() {
  const res = await fetch('/messages?channel=' + channel + '&limit=50', { headers: H });
  const msgs = await res.json();
  const el = document.getElementById('messages');
  el.innerHTML = '';
  seenIds.clear();
  msgCache.clear();
  msgs.forEach(m => { msgCache.set(m.id, m); appendMsg(m); });
  el.scrollTop = el.scrollHeight;
  loadPinned();
}

function appendMsg(m) {
  if (m.channel && m.channel !== channel) return;
  if (m.type === 'connected' || m.type === 'typing' || m.type === 'barrier_cleared') return;
  if (m.id && seenIds.has(m.id)) return;
  if (m.id) seenIds.add(m.id);
  if (m.id) msgCache.set(m.id, m);

  const el = document.getElementById('messages');
  const div = document.createElement('div');
  div.id = 'msg-' + m.id;
  const typeClass = m.type && m.type !== 'chat' ? ' type-' + m.type : '';
  const isReply = m.reply_to ? ' reply' : '';
  const priorityClass = (m.priority === 'urgent' || m.priority === 'high') ? ' priority-' + m.priority : '';
  div.className = 'msg' + typeClass + isReply + priorityClass;

  const badge = m.type && m.type !== 'chat' ? '<span class="badge">' + esc(m.type) + '</span>' : '';
  const receipt = m.read_at ? '<span class="receipt read">✓✓</span>' : '<span class="receipt sent">✓</span>';
  const ts = m.created_at;

  let priorityIndicator = '';
  if (m.priority === 'urgent') priorityIndicator = '<span class="priority-indicator" style="color:var(--red)">🔴</span>';
  else if (m.priority === 'high') priorityIndicator = '<span class="priority-indicator" style="color:var(--orange)">🟠</span>';

  let replyRef = '';
  if (m.reply_to) {
    const parent = msgCache.get(m.reply_to);
    const parentName = parent ? parent.from_agent : '...';
    const parentPreview = parent ? (parent.content || '').slice(0, 40) : '';
    replyRef = '<div class="reply-ref" onclick="scrollToMsg(\\'' + m.reply_to + '\\')">↩ ' + esc(parentName) + ': ' + esc(parentPreview) + '</div>';
  }

  let contentHtml = '';
  if (m.type === 'handoff' && m.metadata) {
    try {
      const meta = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata;
      contentHtml = '<div class="handoff-card"><h4>🤝 Handoff</h4>';
      if (meta.from_task) contentHtml += '<div class="field"><label>Task: </label>' + esc(meta.from_task) + '</div>';
      if (meta.to_agent) contentHtml += '<div class="field"><label>To: </label><span class="mention">@' + esc(meta.to_agent) + '</span></div>';
      if (meta.context) contentHtml += '<div class="field"><label>Context: </label>' + esc(meta.context) + '</div>';
      if (meta.files_changed) contentHtml += '<div class="field"><label>Files: </label>' + esc(Array.isArray(meta.files_changed) ? meta.files_changed.join(', ') : meta.files_changed) + '</div>';
      if (meta.next_steps) contentHtml += '<div class="field"><label>Next: </label>' + esc(Array.isArray(meta.next_steps) ? meta.next_steps.join(', ') : meta.next_steps) + '</div>';
      contentHtml += '</div>';
    } catch { contentHtml = formatContent(m.content || ''); }
  } else {
    contentHtml = formatContent(m.content || '');
  }

  div.innerHTML = '<span class="avatar">' + getAvatar(m.from_agent) + '</span><div class="body">' + replyRef + '<div class="meta"><span class="sender">' + esc(m.from_agent) + '</span>' + badge + priorityIndicator + '<span class="time" title="' + fullTime(ts) + '">' + relativeTime(ts) + '</span>' + receipt + '</div><div class="content">' + contentHtml + '</div></div><div class="msg-actions"><button onclick="setReply(\\'' + m.id + '\\',\\'' + esc(m.from_agent) + '\\')">↩</button><button onclick="pinMsg(\\'' + m.id + '\\')">' + (m.pinned ? '📌' : '📌') + '</button></div>';
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;

  if (m.from_agent !== myId && !m.read_at) {
    fetch('/messages/' + m.id + '/ack', { method: 'POST', headers: H, body: JSON.stringify({ status: 'read' }) }).catch(() => {});
  }
}

function scrollToMsg(id) {
  const el = document.getElementById('msg-' + id);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.style.background = 'var(--bg3)'; setTimeout(() => el.style.background = '', 1500); }
}

function setReply(id, name) {
  replyTo = id;
  document.getElementById('reply-to-name').textContent = name;
  document.getElementById('reply-indicator').classList.add('show');
  document.getElementById('msg-input').focus();
}
function cancelReply() {
  replyTo = null;
  document.getElementById('reply-indicator').classList.remove('show');
}

async function pinMsg(id) {
  await fetch('/messages/' + id + '/pin', { method: 'POST', headers: H, body: JSON.stringify({ pinned: true }) });
  loadPinned();
}

async function loadPinned() {
  const res = await fetch('/messages?channel=' + channel + '&limit=200', { headers: H });
  const msgs = await res.json();
  const pinned = msgs.filter(m => m.pinned);
  const area = document.getElementById('pinned-area');
  const list = document.getElementById('pinned-list');
  if (pinned.length === 0) { area.classList.remove('show'); return; }
  area.classList.add('show');
  list.innerHTML = pinned.map(m => '<div class="pinned-msg"><span class="pin-icon">📌</span><b>' + esc(m.from_agent) + ':</b> ' + esc((m.content || '').slice(0, 80)) + '</div>').join('');
}

function toggleSearch() { document.getElementById('search-bar').classList.toggle('show'); }
let searchDebounce = null;
function searchMessages() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(async () => {
    const q = document.getElementById('search-input').value.trim();
    if (!q) { loadMessages(); return; }
    const res = await fetch('/messages?channel=' + channel + '&limit=50&search=' + encodeURIComponent(q), { headers: H });
    const msgs = await res.json();
    const el = document.getElementById('messages');
    el.innerHTML = '';
    seenIds.clear();
    msgs.forEach(m => appendMsg(m));
  }, 300);
}

async function showSummary() {
  const res = await fetch('/channels/' + channel + '/summary', { headers: H });
  const data = await res.json();
  const el = document.getElementById('summary-content');
  let topicHtml = data.topic ? '<div style="margin-bottom:12px;padding:8px;background:var(--bg3);border-radius:4px"><b>Topic:</b> ' + esc(data.topic) + '</div>' : '';
  el.innerHTML = topicHtml + data.summary.map(s => '<div class="summary-msg"><b>' + esc(s.from) + '</b> (' + relativeTime(s.time) + '): ' + esc(s.content) + '</div>').join('');
  document.getElementById('summary-modal').style.display = 'block';
  document.getElementById('overlay').style.display = 'block';
}
function closeSummary() {
  document.getElementById('summary-modal').style.display = 'none';
  document.getElementById('overlay').style.display = 'none';
}

function toggleTasks() { document.getElementById('task-panel').classList.toggle('show'); }
function toggleTaskForm() { document.getElementById('task-form').classList.toggle('show'); }

let showArchived = false;
async function loadTasks() {
  let url = '/tasks?channel=' + channel;
  if (taskFilter === 'archived') url = '/tasks/archived?channel=' + channel;
  else if (taskFilter === 'ready') url = '/tasks/ready';
  else if (taskFilter === 'blocked') url = '/tasks/blocked';
  else if (showArchived) url += '&include_archived=true';

  const res = await fetch(url, { headers: H });
  const tasks = await res.json();
  const el = document.getElementById('task-list');
  // Sort: stale/unclaimed first, then pending, in_progress, done, archived
  const statusOrder = { pending: 0, in_progress: 1, done: 2, blocked: 1, archived: 3 };
  tasks.sort((a, b) => {
    if (a.stale && !b.stale) return -1;
    if (!a.stale && b.stale) return 1;
    if (!a.assigned_to && a.status === 'pending' && (b.assigned_to || b.status !== 'pending')) return -1;
    if ((!b.assigned_to && b.status === 'pending') && (a.assigned_to || a.status !== 'pending')) return 1;
    return (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9);
  });
  el.innerHTML = tasks.map(t => {
    const depsHtml = t.depends_on ? '<div class="task-deps">⛓ Depends on: ' + esc(t.depends_on) + '</div>' : '';
    const deadlineHtml = t.deadline ? '<div class="task-deadline">⏰ ' + fullTime(t.deadline) + '</div>' : '';
    const blockingHtml = t.blocking_deps !== undefined ? '<div class="task-deps" style="color:var(--red)">🚫 ' + t.blocking_deps + '/' + t.total_deps + ' deps blocking</div>' : '';
    const isStale = t.stale ? ' stale' : '';
    const isUnclaimed = (!t.assigned_to && t.status === 'pending' && !t.stale) ? ' unclaimed' : '';
    const claimedBy = (t.status === 'in_progress' && t.assigned_to) ? '<div class="task-claimed-by">✋ Claimed by ' + esc(t.assigned_to) + '</div>' : '';
    const doneCheck = t.status === 'done' ? '<span class="task-done-check"> ✔</span>' : '';
    const claimBtn = (t.status === 'pending' && !t.assigned_to) ? '<button onclick="event.stopPropagation();claimTask(\\'' + t.id + '\\')" style="background:var(--accent);border:none;border-radius:3px;padding:2px 8px;color:#fff;cursor:pointer;font-size:10px;margin-left:6px">Claim</button>' : '';
    return '<div class="task-item' + isStale + isUnclaimed + '" onclick="cycleTaskStatus(\\'' + t.id + '\\',\\'' + t.status + '\\')"><div class="task-title">' + esc(t.title) + doneCheck + '</div><div class="task-meta"><span class="task-status ' + t.status + '">' + t.status + '</span><span class="task-priority ' + t.priority + '">' + t.priority + '</span> → ' + esc(t.assigned_to || 'unassigned') + claimBtn + '</div>' + claimedBy + depsHtml + deadlineHtml + blockingHtml + '<div class="task-delegations" id="deleg-' + t.id + '"></div></div>';
  }).join('') || '<div style="padding:16px;color:var(--text-dim);font-size:13px">No tasks</div>';
  // Load delegations for each task
  for (const t of tasks) {
    fetch('/delegations?task_id=' + t.id, { headers: H }).then(r => r.json()).then(dels => {
      const del_el = document.getElementById('deleg-' + t.id);
      if (del_el && Array.isArray(dels) && dels.length) {
        del_el.innerHTML = dels.map(d => '<div class="deleg-line"><span class="deleg-status ' + d.status + '">' + d.status + '</span> Delegated to: ' + (d.sub_agent_label || d.sub_agent_id) + '</div>').join('');
      }
    }).catch(() => {});
  }
}

function filterTasks(filter, btn) {
  taskFilter = filter;
  document.querySelectorAll('.task-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadTasks();
}

async function createTask() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) return;
  const deps = document.getElementById('task-deps').value.trim();
  const deadline = document.getElementById('task-deadline').value.trim();
  const body = {
    title,
    description: document.getElementById('task-desc').value.trim() || undefined,
    assigned_to: document.getElementById('task-assign').value.trim() || undefined,
    created_by: myId,
    priority: document.getElementById('task-priority').value,
    channel,
    depends_on: deps ? deps.split(',').map(s => s.trim()) : undefined,
    deadline: deadline ? Number(deadline) : undefined,
  };
  await fetch('/tasks', { method: 'POST', headers: H, body: JSON.stringify(body) });
  document.getElementById('task-title').value = '';
  document.getElementById('task-desc').value = '';
  document.getElementById('task-assign').value = '';
  document.getElementById('task-deps').value = '';
  document.getElementById('task-deadline').value = '';
  toggleTaskForm();
  loadTasks();
}

const statusCycle = { pending: 'in_progress', in_progress: 'done', done: 'pending', blocked: 'pending', archived: 'pending' };
async function claimTask(id) {
  await fetch('/tasks/' + id + '/claim', { method: 'POST', headers: H, body: JSON.stringify({ agent_id: myId }) });
  loadTasks();
}

async function cycleTaskStatus(id, current) {
  if (current === 'in_progress') {
    await fetch('/tasks/' + id + '/complete', { method: 'POST', headers: H, body: JSON.stringify({ agent_id: myId }) });
  } else {
    const next = statusCycle[current] || 'pending';
    await fetch('/tasks/' + id, { method: 'PATCH', headers: H, body: JSON.stringify({ status: next, updated_by: myId }) });
  }
  loadTasks();
}

async function loadMemory() {
  const res = await fetch('/memory', { headers: H });
  const items = await res.json();
  const el = document.getElementById('memory-entries');
  el.innerHTML = items.map(m => '<div class="mem-item"><span class="mem-key">' + esc(m.key) + '</span><span class="mem-val">' + esc(m.value) + '</span><span class="mem-by">' + esc(m.updated_by || '') + '</span></div>').join('') || '<div style="padding:8px 16px;font-size:12px;color:var(--text-dim)">No entries</div>';
}
function toggleMemory() {
  document.getElementById('memory-entries').classList.toggle('show');
  loadMemory();
}

// Workflows
async function loadWorkflows() {
  try {
    const res = await fetch('/workflows', { headers: H });
    const all = await res.json();
    const recent = (Array.isArray(all) ? all : []).slice(0, 5);
    const el = document.getElementById('workflow-list');
    if (!recent.length) { el.innerHTML = '<div style="font-size:11px;color:var(--text-dim);padding:4px 0">No workflows</div>'; return; }
    el.innerHTML = recent.map(w => '<div class="wf-item"><span class="wf-status ' + esc(w.status) + '">' + esc(w.status) + '</span> ' + esc(w.name) + '</div>').join('');
  } catch { }
}
function toggleWorkflows() {
  const el = document.getElementById('workflow-list');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
  loadWorkflows();
}

// Delegations
async function loadDelegations() {
  try {
    const res = await fetch('/delegations/active', { headers: H });
    const items = await res.json();
    const el = document.getElementById('delegation-list');
    if (!Array.isArray(items) || !items.length) { el.innerHTML = '<div style="font-size:11px;color:var(--text-dim);padding:4px 16px">No active delegations</div>'; return; }
    el.innerHTML = items.map(d => '<div class="deleg-item"><span class="deleg-status ' + esc(d.status) + '">' + esc(d.status) + '</span> <span class="deleg-label">' + esc(d.sub_agent_label) + '</span><div class="deleg-task">' + esc(d.task_title || d.task_id) + '</div></div>').join('');
  } catch { }
}
function toggleDelegations() {
  const el = document.getElementById('delegation-list');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
  loadDelegations();
}

function sendTyping() {
  fetch('/agents/' + myId + '/typing', { method: 'POST', headers: H }).catch(() => {});
}

let lastPollTime = 0;

function connectSSE() {
  if (sse) sse.close();
  sse = new EventSource('/stream?agent=' + myId + '&key=' + API_KEY);

  const handleMsg = (e) => {
    try {
      const m = JSON.parse(e.data);
      if (m.type === 'typing') { showTyping(m.agent); return; }
      if (m.type === 'barrier_cleared') { loadTasks(); return; }
      appendMsg(m);
      if (m.from_agent !== myId) {
        if (m.priority === 'urgent') playUrgentBeep();
        else playBeep();
      }
    } catch {}
  };

  sse.addEventListener('message', handleMsg);
  sse.addEventListener('urgent', handleMsg);
  sse.addEventListener('system', () => {});
  sse.onerror = () => { sse.close(); sse = null; setTimeout(connectSSE, 3000); };
}

let typingClear = null;
function showTyping(agent) {
  document.getElementById('typing-indicator').textContent = agent + ' is typing...';
  clearTimeout(typingClear);
  typingClear = setTimeout(() => { document.getElementById('typing-indicator').textContent = ''; }, 3000);
}

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

document.querySelectorAll('.ch-btn[data-ch]').forEach(btn => {
  btn.addEventListener('click', () => switchChannel(btn.dataset.ch, btn));
});

async function sendMsg() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;
  const type = document.getElementById('msg-type').value;
  const priority = document.getElementById('msg-priority').value;
  const body = { from_agent: myId, channel, type, content: text, priority };
  if (replyTo) body.reply_to = replyTo;
  const res2 = await fetch('/messages', { method: 'POST', headers: H, body: JSON.stringify(body) });
  const result = await res2.json();
  input.value = '';
  cancelReply();
  if (result.message) {
    appendMsg({ id: result.message.id, from_agent: myId, channel, type, content: text, created_at: result.message.created_at, reply_to: replyTo, priority });
  }
}

document.getElementById('send-btn').addEventListener('click', sendMsg);
document.getElementById('msg-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMsg();
  else sendTyping();
});

document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

setInterval(() => {
  document.querySelectorAll('.msg .time').forEach(el => {
    const ts = el.getAttribute('title');
    if (ts) {
      const d = new Date(ts).getTime();
      if (!isNaN(d)) el.textContent = relativeTime(d);
    }
  });
}, 30000);

setInterval(loadAgents, 30000);
init();
</script>
</body>
</html>`;
