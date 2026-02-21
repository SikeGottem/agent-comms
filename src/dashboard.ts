export const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Comms Dashboard</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --bg: #1a1a2e; --sidebar: #16213e; --cards: #0f3460; --accent: #e94560;
  --accent-dim: rgba(233,69,96,0.15); --text: #e0e0e0; --text-dim: #8892a4;
  --text-muted: #5a6478; --border: #1e2d4a; --green: #4ade80; --orange: #fb923c;
  --red: #ef4444; --blue: #3b82f6; --yellow: #facc15; --purple: #a855f7;
  --gray: #64748b; --surface: #1e2d4a; --hover: rgba(233,69,96,0.08);
  --msg-bg: transparent; --radius: 8px; --transition: 200ms ease;
}
body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); height: 100vh; display: grid; grid-template-columns: 240px 1fr 0px; overflow: hidden; font-size: 14px; }
body.right-open { grid-template-columns: 240px 1fr 280px; }

/* Scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--gray); }

/* ===== LEFT SIDEBAR ===== */
#left-sidebar { background: var(--sidebar); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; transition: transform var(--transition); z-index: 50; }
#left-sidebar .sidebar-header { padding: 16px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--border); }
#left-sidebar .sidebar-header h1 { font-size: 16px; font-weight: 700; background: linear-gradient(135deg, var(--accent), var(--purple)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
#left-sidebar .sidebar-header .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 6px var(--green); }

/* Channels */
.channel-section { padding: 12px 0; }
.channel-section h3 { padding: 0 16px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: var(--text-muted); font-weight: 600; }
.ch-btn { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; background: none; border: none; color: var(--text-dim); padding: 6px 16px; cursor: pointer; font-size: 14px; transition: all var(--transition); position: relative; }
.ch-btn:hover { background: var(--hover); color: var(--text); }
.ch-btn.active { background: var(--accent-dim); color: #fff; border-right: 2px solid var(--accent); }
.ch-btn .ch-hash { color: var(--text-muted); font-weight: 700; }
.ch-btn .unread-badge { position: absolute; right: 12px; background: var(--accent); color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 10px; min-width: 18px; text-align: center; }
.ch-btn-add { color: var(--accent) !important; font-size: 12px; opacity: 0.7; }
.ch-btn-add:hover { opacity: 1; }

/* Agent list */
.agent-section { flex: 1; overflow-y: auto; padding-bottom: 12px; }
.agent-section h3 { padding: 12px 16px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; color: var(--text-muted); font-weight: 600; }
.agent-card { display: flex; align-items: center; gap: 10px; padding: 8px 16px; cursor: pointer; transition: background var(--transition); border-radius: 0; }
.agent-card:hover { background: var(--hover); }
.agent-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; color: #fff; flex-shrink: 0; position: relative; }
.agent-avatar .presence-dot { position: absolute; bottom: -1px; right: -1px; width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--sidebar); }
.presence-dot.online { background: var(--green); box-shadow: 0 0 6px var(--green); }
.presence-dot.possibly_offline { background: var(--orange); box-shadow: 0 0 6px var(--orange); }
.presence-dot.offline { background: var(--gray); }
.presence-dot.busy { background: var(--red); box-shadow: 0 0 6px var(--red); }
.agent-info { flex: 1; min-width: 0; }
.agent-name { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.agent-status-text { font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.agent-badges { display: flex; gap: 4px; }
.agent-task-count { font-size: 10px; background: var(--cards); color: var(--text-dim); padding: 1px 6px; border-radius: 10px; }

/* Agent popup */
.agent-popup { display: none; position: fixed; z-index: 300; background: var(--sidebar); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; width: 280px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
.agent-popup.show { display: block; }
.agent-popup h4 { font-size: 15px; margin-bottom: 8px; }
.agent-popup .popup-field { font-size: 12px; color: var(--text-dim); margin: 4px 0; }
.agent-popup .popup-field b { color: var(--text); }
.agent-popup .cap-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.agent-popup .cap-tag { font-size: 10px; background: var(--accent-dim); color: var(--accent); padding: 2px 6px; border-radius: 4px; }

/* ===== MAIN CENTER ===== */
#center { display: flex; flex-direction: column; min-width: 0; min-height: 0; height: 100%; overflow: hidden; background: var(--bg); }

/* Header */
#header { padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--sidebar); display: flex; align-items: center; gap: 12px; }
#hamburger { display: none; background: none; border: none; color: var(--text); font-size: 20px; cursor: pointer; padding: 4px; }
#header .channel-name { font-size: 16px; font-weight: 700; flex: 1; }
#header .channel-name .ch-icon { color: var(--text-muted); margin-right: 4px; }
.header-actions { display: flex; gap: 6px; }
.header-btn { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; color: var(--text-dim); cursor: pointer; font-size: 12px; transition: all var(--transition); display: flex; align-items: center; gap: 4px; }
.header-btn:hover { background: var(--cards); color: #fff; border-color: var(--accent); }
.header-btn.active { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); }

/* Topic bar */
#topic-bar { padding: 6px 16px; background: var(--surface); border-bottom: 1px solid var(--border); font-size: 12px; color: var(--text-dim); display: none; }
#topic-bar.show { display: block; }

/* Search */
#search-bar { padding: 8px 16px; border-bottom: 1px solid var(--border); background: var(--sidebar); display: none; }
#search-bar.show { display: block; }
#search-bar input { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; color: var(--text); font-size: 14px; outline: none; transition: border var(--transition); }
#search-bar input:focus { border-color: var(--accent); }

/* Pinned messages */
#pinned-area { border-bottom: 1px solid var(--border); background: var(--sidebar); max-height: 0; overflow: hidden; transition: max-height 0.3s ease; }
#pinned-area.show { max-height: 150px; overflow-y: auto; }
.pinned-header { padding: 6px 16px; font-size: 11px; color: var(--yellow); font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
.pinned-msg { padding: 4px 16px 4px 32px; font-size: 12px; color: var(--text-dim); }
.pinned-msg b { color: var(--text); }

/* Messages */
#messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 2px; scroll-behavior: smooth; }

/* Time separators */
.time-separator { display: flex; align-items: center; gap: 12px; padding: 16px 0 8px; }
.time-separator span { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }
.time-separator::before, .time-separator::after { content: ''; flex: 1; height: 1px; background: var(--border); }

/* Message */
.msg { display: flex; gap: 12px; padding: 8px 12px; border-radius: 6px; position: relative; transition: background var(--transition); border-left: 3px solid transparent; }
.msg:hover { background: rgba(255,255,255,0.02); }
.msg:hover .msg-actions { opacity: 1; pointer-events: auto; }
.msg-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; color: #fff; flex-shrink: 0; margin-top: 2px; }
.msg-body { flex: 1; min-width: 0; }
.msg-meta { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.msg-sender { font-weight: 700; font-size: 14px; color: #fff; }
.msg-badge { font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
.msg-time { font-size: 11px; color: var(--text-muted); cursor: help; }
.msg-receipt { font-size: 11px; margin-left: 2px; }
.msg-receipt.sent { color: var(--gray); }
.msg-receipt.delivered { color: var(--gray); }
.msg-receipt.read { color: var(--blue); }
.msg-content { font-size: 14px; line-height: 1.5; margin-top: 3px; word-break: break-word; color: var(--text); }
.msg-read-info { font-size: 10px; color: var(--text-muted); margin-top: 2px; }

/* Priority messages */
.msg.priority-urgent { border-left-color: var(--red); background: rgba(239,68,68,0.06); animation: urgentPulse 2s ease-in-out 3; }
.msg.priority-high { border-left-color: var(--orange); }
@keyframes urgentPulse { 0%,100% { background: rgba(239,68,68,0.06); } 50% { background: rgba(239,68,68,0.12); } }

/* Reply messages */
.msg.reply { margin-left: 48px; position: relative; }
.msg.reply::before { content: ''; position: absolute; left: -24px; top: 0; bottom: 50%; width: 2px; background: var(--accent); border-radius: 1px; }
.msg.reply::after { content: ''; position: absolute; left: -24px; top: 50%; width: 20px; height: 2px; background: var(--accent); border-radius: 1px; }
.reply-ref { font-size: 11px; color: var(--accent); margin-bottom: 4px; cursor: pointer; opacity: 0.8; }
.reply-ref:hover { opacity: 1; text-decoration: underline; }

/* Type badges */
.badge-task { background: var(--orange); color: #fff; }
.badge-status_update { background: var(--blue); color: #fff; }
.badge-handoff { background: var(--purple); color: #fff; }
.badge-code_review { background: #22c55e; color: #fff; }
.badge-approval { background: var(--red); color: #fff; }
.badge-request { background: #06b6d4; color: #fff; }
.badge-response { background: #22c55e; color: #fff; }
.badge-broadcast { background: var(--purple); color: #fff; }
.badge-heartbeat { background: var(--green); color: #000; }
.badge-coordination { background: var(--yellow); color: #000; }
.badge-delegation { background: var(--blue); color: #fff; }

/* Hover actions */
.msg-actions { position: absolute; top: -12px; right: 8px; display: flex; gap: 2px; background: var(--sidebar); border: 1px solid var(--border); border-radius: 6px; padding: 2px; opacity: 0; pointer-events: none; transition: opacity var(--transition); box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
.msg-actions button { background: none; border: none; padding: 4px 8px; color: var(--text-dim); cursor: pointer; font-size: 13px; border-radius: 4px; transition: all var(--transition); }
.msg-actions button:hover { background: var(--hover); color: #fff; }

/* Code blocks */
pre.code-block { background: #0d1117; padding: 12px; border-radius: 6px; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; font-size: 13px; overflow-x: auto; margin-top: 6px; border: 1px solid var(--border); }
pre.code-block code { color: #e6edf3; }
.code-lang { font-size: 10px; color: var(--accent); text-transform: uppercase; margin-bottom: 2px; font-weight: 600; }
/* Syntax highlighting via CSS */
pre.code-block .kw { color: #ff7b72; }
pre.code-block .str { color: #a5d6ff; }
pre.code-block .num { color: #79c0ff; }
pre.code-block .cmt { color: #8b949e; font-style: italic; }
pre.code-block .fn { color: #d2a8ff; }

/* Handoff card */
.handoff-card { background: var(--surface); border: 1px solid var(--purple); border-radius: var(--radius); padding: 12px; margin-top: 6px; }
.handoff-card h4 { color: var(--purple); margin-bottom: 8px; font-size: 13px; }
.handoff-card .field { font-size: 12px; margin: 3px 0; }
.handoff-card .field label { color: var(--text-dim); }

/* Mentions */
.mention { color: var(--accent); font-weight: 700; background: var(--accent-dim); padding: 0 3px; border-radius: 3px; }

/* Typing indicator */
#typing-indicator { padding: 4px 16px; font-size: 12px; color: var(--text-dim); min-height: 24px; display: flex; align-items: center; gap: 6px; }
.typing-dots { display: inline-flex; gap: 3px; }
.typing-dots span { width: 4px; height: 4px; background: var(--text-dim); border-radius: 50%; animation: typingBounce 1.4s infinite; }
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typingBounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }

/* Reply indicator */
#reply-indicator { padding: 8px 16px; background: var(--surface); border-top: 2px solid var(--accent); display: none; font-size: 12px; color: var(--text-dim); align-items: center; gap: 8px; }
#reply-indicator.show { display: flex; }
#reply-indicator .cancel-reply { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px; margin-left: auto; padding: 0 4px; }
#reply-indicator .cancel-reply:hover { color: var(--text); }

/* Input area */
#input-area { padding: 12px 16px; border-top: 1px solid var(--border); background: var(--sidebar); flex-shrink: 0; }
#input-row { display: flex; gap: 8px; align-items: flex-end; }
#msg-input { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; color: var(--text); font-size: 14px; outline: none; resize: none; min-height: 40px; max-height: 120px; font-family: inherit; line-height: 1.4; transition: border var(--transition); overflow-y: auto; }
#msg-input:focus { border-color: var(--accent); }
#msg-input::placeholder { color: var(--text-muted); }
.input-controls { display: flex; gap: 6px; align-items: center; margin-top: 6px; }
.input-select { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; color: var(--text-dim); font-size: 11px; cursor: pointer; outline: none; transition: all var(--transition); }
.input-select:hover, .input-select:focus { border-color: var(--accent); color: var(--text); }
#send-btn { background: var(--accent); border: none; border-radius: 8px; padding: 10px 20px; color: #fff; font-weight: 600; cursor: pointer; font-size: 14px; transition: all var(--transition); white-space: nowrap; }
#send-btn:hover { opacity: 0.9; transform: scale(1.02); }

/* @ mention autocomplete */
#mention-popup { display: none; position: absolute; bottom: 100%; left: 16px; background: var(--sidebar); border: 1px solid var(--border); border-radius: 8px; padding: 4px; max-height: 200px; overflow-y: auto; z-index: 100; min-width: 200px; box-shadow: 0 -4px 16px rgba(0,0,0,0.3); }
#mention-popup.show { display: block; }
.mention-item { padding: 6px 10px; cursor: pointer; border-radius: 4px; font-size: 13px; display: flex; align-items: center; gap: 8px; transition: background var(--transition); }
.mention-item:hover, .mention-item.selected { background: var(--accent-dim); color: #fff; }

/* ===== RIGHT SIDEBAR ===== */
#right-sidebar { background: var(--sidebar); border-left: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; transition: width var(--transition); }
.right-tabs { display: flex; border-bottom: 1px solid var(--border); }
.right-tab { flex: 1; padding: 10px 8px; text-align: center; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); cursor: pointer; border-bottom: 2px solid transparent; transition: all var(--transition); background: none; border-top: none; border-left: none; border-right: none; }
.right-tab:hover { color: var(--text); }
.right-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.right-content { flex: 1; overflow-y: auto; }
.right-panel { display: none; }
.right-panel.active { display: block; }

/* Tasks panel */
.task-filters { display: flex; gap: 4px; padding: 8px 12px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.task-filter-btn { background: none; border: 1px solid var(--border); border-radius: 16px; padding: 3px 10px; color: var(--text-dim); cursor: pointer; font-size: 11px; transition: all var(--transition); }
.task-filter-btn:hover, .task-filter-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
#task-form { display: none; padding: 12px; border-bottom: 1px solid var(--border); animation: slideDown 0.2s ease; }
#task-form.show { display: block; }
@keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
#task-form input, #task-form select, #task-form textarea { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; color: var(--text); font-size: 12px; margin-bottom: 6px; font-family: inherit; outline: none; transition: border var(--transition); }
#task-form input:focus, #task-form textarea:focus { border-color: var(--accent); }
#task-form textarea { resize: vertical; min-height: 40px; }
#task-form button { background: var(--accent); border: none; border-radius: 6px; padding: 8px; color: #fff; cursor: pointer; font-size: 12px; width: 100%; font-weight: 600; transition: opacity var(--transition); }
#task-form button:hover { opacity: 0.9; }
.task-create-btn { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 12px; margin: 8px 12px; background: var(--accent-dim); border: 1px dashed var(--accent); border-radius: 6px; color: var(--accent); cursor: pointer; font-size: 12px; transition: all var(--transition); }
.task-create-btn:hover { background: var(--accent); color: #fff; border-style: solid; }
.task-item { padding: 10px 12px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background var(--transition); border-left: 3px solid transparent; }
.task-item:hover { background: var(--hover); }
.task-item .task-header { display: flex; align-items: center; gap: 6px; }
.task-item .task-title { font-size: 13px; font-weight: 600; color: var(--text); flex: 1; }
.task-item .task-done-check { color: var(--green); }
.task-meta-row { display: flex; align-items: center; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
.task-status { font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
.task-status.pending { background: var(--gray); color: #fff; }
.task-status.in_progress { background: var(--blue); color: #fff; }
.task-status.done { background: var(--green); color: #000; }
.task-status.blocked { background: var(--red); color: #fff; }
.task-status.archived { background: #374151; color: #9ca3af; }
.task-priority { font-size: 10px; padding: 1px 6px; border-radius: 4px; }
.task-priority.urgent { background: var(--red); color: #fff; }
.task-priority.high { background: var(--orange); color: #fff; }
.task-priority.medium { background: var(--blue); color: #fff; }
.task-priority.low { background: var(--gray); color: #fff; }
.task-assignee { font-size: 11px; color: var(--text-muted); }
.task-item.unclaimed { border-left-color: var(--yellow); }
.task-item.unclaimed .task-title::before { content: ''; display: inline-block; width: 6px; height: 6px; background: var(--yellow); border-radius: 50%; margin-right: 6px; animation: pulse-dot 1.5s infinite; }
@keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
.claim-btn { font-size: 10px; background: var(--accent); color: #fff; border: none; border-radius: 4px; padding: 2px 8px; cursor: pointer; transition: opacity var(--transition); }
.claim-btn:hover { opacity: 0.8; }
.task-progress { width: 100%; height: 3px; background: var(--border); border-radius: 2px; margin-top: 4px; overflow: hidden; }
.task-progress-bar { height: 100%; background: var(--accent); border-radius: 2px; transition: width 0.5s ease; }
.task-deps { font-size: 10px; color: var(--yellow); margin-top: 3px; }
.task-details { display: none; padding: 8px 0 0; font-size: 12px; color: var(--text-dim); line-height: 1.5; animation: slideDown 0.2s ease; }
.task-details.show { display: block; }

/* Workflows panel */
.wf-item { padding: 10px 12px; border-bottom: 1px solid var(--border); }
.wf-name { font-size: 13px; font-weight: 600; color: var(--text); }
.wf-status { font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
.wf-status.active, .wf-status.running { background: var(--blue); color: #fff; }
.wf-status.completed { background: var(--green); color: #000; }
.wf-status.failed { background: var(--red); color: #fff; }
.wf-status.pending { background: var(--gray); color: #fff; }
.wf-steps { margin-top: 6px; }
.wf-step { font-size: 11px; padding: 2px 0; color: var(--text-dim); display: flex; gap: 6px; }

/* Memory panel */
.mem-item { padding: 8px 12px; border-bottom: 1px solid var(--border); }
.mem-key { font-size: 12px; font-weight: 600; color: var(--accent); }
.mem-val { font-size: 12px; color: var(--text-dim); margin-top: 2px; word-break: break-word; }
.mem-by { font-size: 10px; color: var(--text-muted); }

/* Knowledge panel */
.knowledge-item { padding: 10px 12px; border-bottom: 1px solid var(--border); }
.knowledge-item .k-title { font-size: 13px; font-weight: 600; color: var(--text); }
.knowledge-item .k-content { font-size: 12px; color: var(--text-dim); margin-top: 3px; }
.knowledge-item .k-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.knowledge-item .k-tag { font-size: 10px; background: var(--accent-dim); color: var(--accent); padding: 1px 6px; border-radius: 4px; }

/* ===== MODALS ===== */
#overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 199; backdrop-filter: blur(2px); }
#overlay.show { display: block; }
.modal { display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--sidebar); border: 1px solid var(--border); border-radius: 12px; padding: 24px; width: 500px; max-width: 90vw; max-height: 80vh; overflow-y: auto; z-index: 200; box-shadow: 0 16px 48px rgba(0,0,0,0.4); }
.modal.show { display: block; }
.modal h3 { margin-bottom: 16px; font-size: 18px; }
.modal .close-btn { position: absolute; top: 12px; right: 16px; background: none; border: none; color: var(--text-muted); font-size: 20px; cursor: pointer; transition: color var(--transition); }
.modal .close-btn:hover { color: #fff; }

/* Toast */
.toast-container { position: fixed; bottom: 80px; right: 20px; z-index: 500; display: flex; flex-direction: column; gap: 8px; }
.toast { background: var(--sidebar); border: 1px solid var(--border); border-radius: 8px; padding: 10px 16px; font-size: 13px; box-shadow: 0 4px 16px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 8px; animation: toastIn 0.3s ease, toastOut 0.3s ease 2.7s forwards; max-width: 350px; }
.toast.error { border-color: var(--red); }
.toast.success { border-color: var(--green); }
@keyframes toastIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes toastOut { from { opacity: 1; } to { opacity: 0; } }

/* Loading skeleton */
.skeleton { background: linear-gradient(90deg, var(--surface) 25%, var(--border) 50%, var(--surface) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 4px; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
.skeleton-msg { display: flex; gap: 12px; padding: 8px 12px; }
.skeleton-avatar { width: 36px; height: 36px; border-radius: 50%; }
.skeleton-lines { flex: 1; display: flex; flex-direction: column; gap: 6px; }
.skeleton-line { height: 12px; border-radius: 4px; }
.skeleton-line.short { width: 40%; }
.skeleton-line.medium { width: 70%; }
.skeleton-line.long { width: 90%; }

/* Empty state */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; color: var(--text-muted); text-align: center; }
.empty-state .emoji { font-size: 48px; margin-bottom: 12px; }
.empty-state .title { font-size: 16px; font-weight: 600; color: var(--text-dim); margin-bottom: 4px; }
.empty-state .subtitle { font-size: 13px; }

/* ===== MOBILE ===== */
@media (max-width: 768px) {
  body { grid-template-columns: 1fr !important; }
  #left-sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 280px; transform: translateX(-100%); z-index: 100; }
  #left-sidebar.open { transform: translateX(0); }
  #hamburger { display: block; }
  #right-sidebar { position: fixed; bottom: 0; left: 0; right: 0; height: 60vh; transform: translateY(100%); z-index: 100; border-radius: 16px 16px 0 0; border-left: none; border-top: 1px solid var(--border); }
  body.right-open #right-sidebar { transform: translateY(0); }
  body.right-open { grid-template-columns: 1fr !important; }
  .msg-actions { display: none !important; }
  .agent-card, .ch-btn, .task-item, .claim-btn, .header-btn { min-height: 44px; display: flex; align-items: center; }
}

/* Fade transition for channel switching */
#messages.fade-out { opacity: 0; transition: opacity 0.15s ease; }
#messages.fade-in { opacity: 1; transition: opacity 0.15s ease; }
</style>
</head>
<body>
<!-- Left Sidebar -->
<div id="left-sidebar">
  <div class="sidebar-header">
    <div class="status-dot"></div>
    <h1>Agent Comms</h1>
  </div>
  <div class="channel-section">
    <h3>Channels</h3>
    <div id="channel-list">
      <button class="ch-btn active" data-ch="general"><span class="ch-hash">#</span> general</button>
      <button class="ch-btn" data-ch="tasks"><span class="ch-hash">#</span> tasks</button>
      <button class="ch-btn" data-ch="alerts"><span class="ch-hash">#</span> alerts</button>
    </div>
    <button class="ch-btn ch-btn-add" onclick="showCreateChannel()">+ New Channel</button>
  </div>
  <div class="agent-section">
    <h3>Agents — <span id="agent-count">0</span> online</h3>
    <div id="agent-list"></div>
  </div>
</div>

<!-- Center -->
<div id="center">
  <div id="header">
    <button id="hamburger" onclick="toggleSidebar()">☰</button>
    <div class="channel-name"><span class="ch-icon">#</span> <span id="ch-name">general</span></div>
    <div class="header-actions">
      <button class="header-btn" onclick="toggleSearch()" title="Search (Ctrl+K)">🔍</button>
      <button class="header-btn" onclick="togglePinned()">📌</button>
      <button class="header-btn" onclick="showSummary()">📋</button>
      <button class="header-btn" id="right-toggle" onclick="toggleRight()">☰ Panel</button>
    </div>
  </div>
  <div id="topic-bar">📌 <span id="topic-text"></span></div>
  <div id="search-bar"><input type="text" id="search-input" placeholder="Search messages... (Ctrl+K)" oninput="searchMessages()"></div>
  <div id="pinned-area"><div class="pinned-header" onclick="togglePinned()">📌 Pinned Messages <span id="pin-count"></span></div><div id="pinned-list"></div></div>
  <div id="messages"></div>
  <div id="typing-indicator"></div>
  <div id="reply-indicator"><span>↩ Replying to <b id="reply-to-name"></b></span><button class="cancel-reply" onclick="cancelReply()">✕</button></div>
  <div id="input-area" style="position:relative">
    <div id="mention-popup"></div>
    <div id="input-row">
      <textarea id="msg-input" rows="1" placeholder="Message #general — Enter to send, Shift+Enter for newline"></textarea>
      <button id="send-btn">Send</button>
    </div>
    <div class="input-controls">
      <select class="input-select" id="msg-type">
        <option value="chat">💬 Chat</option>
        <option value="request">📨 Request</option>
        <option value="broadcast">📢 Broadcast</option>
        <option value="task">📋 Task</option>
        <option value="status_update">📊 Status</option>
        <option value="code_review">💻 Code</option>
        <option value="handoff">🤝 Handoff</option>
        <option value="approval">✅ Approval</option>
        <option value="coordination">🔗 Coordination</option>
        <option value="delegation">🤖 Delegation</option>
      </select>
      <select class="input-select" id="msg-priority">
        <option value="normal">Normal</option>
        <option value="low">Low</option>
        <option value="high">⚠️ High</option>
        <option value="urgent">🔴 Urgent</option>
      </select>
    </div>
  </div>
</div>

<!-- Right Sidebar -->
<div id="right-sidebar">
  <div class="right-tabs">
    <button class="right-tab active" data-tab="tasks" onclick="switchRightTab('tasks',this)">Tasks</button>
    <button class="right-tab" data-tab="workflows" onclick="switchRightTab('workflows',this)">Workflows</button>
    <button class="right-tab" data-tab="memory" onclick="switchRightTab('memory',this)">Memory</button>
    <button class="right-tab" data-tab="knowledge" onclick="switchRightTab('knowledge',this)">Knowledge</button>
  </div>
  <div class="right-content">
    <!-- Tasks -->
    <div class="right-panel active" id="panel-tasks">
      <div class="task-create-btn" onclick="toggleTaskForm()">+ New Task</div>
      <div id="task-form">
        <input type="text" id="task-title" placeholder="Task title">
        <textarea id="task-desc" placeholder="Description (optional)"></textarea>
        <input type="text" id="task-assign" placeholder="Assign to (agent id)">
        <input type="text" id="task-deps" placeholder="Depends on (task IDs, comma-separated)">
        <select id="task-priority-sel"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select>
        <button onclick="createTask()">Create Task</button>
      </div>
      <div class="task-filters">
        <button class="task-filter-btn active" onclick="filterTasks('all',this)">All</button>
        <button class="task-filter-btn" onclick="filterTasks('ready',this)">Ready</button>
        <button class="task-filter-btn" onclick="filterTasks('blocked',this)">Blocked</button>
        <button class="task-filter-btn" onclick="filterTasks('archived',this)">📦</button>
      </div>
      <div id="task-list"></div>
    </div>
    <!-- Workflows -->
    <div class="right-panel" id="panel-workflows">
      <div id="workflow-list"></div>
    </div>
    <!-- Memory -->
    <div class="right-panel" id="panel-memory">
      <div id="memory-list"></div>
    </div>
    <!-- Knowledge -->
    <div class="right-panel" id="panel-knowledge">
      <div id="knowledge-list"></div>
    </div>
  </div>
</div>

<!-- Modals -->
<div id="overlay" onclick="closeModals()"></div>
<div class="modal" id="summary-modal"><button class="close-btn" onclick="closeModals()">✕</button><h3>Channel Summary</h3><div id="summary-content"></div></div>
<div class="agent-popup" id="agent-popup"></div>
<div class="toast-container" id="toasts"></div>

<script>
const API_KEY = 'key-agent-gamma';
const H = { 'X-Agent-Key': API_KEY, 'Content-Type': 'application/json' };
let channel = 'general';
let sse = null;
const seenIds = new Set();
let replyTo = null;
let taskFilter = 'all';
const msgCache = new Map();
let autoScroll = true;
let agentCache = [];
let rightOpen = false;

// Name setup
let myName = localStorage.getItem('agent-comms-name');
if (!myName) { myName = prompt('Your name?') || 'Anonymous'; localStorage.setItem('agent-comms-name', myName); }
const myId = 'human-' + myName.toLowerCase().replace(/[^a-z0-9]/g, '');

// Avatar colors
const avatarColors = ['#e94560','#a855f7','#3b82f6','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#8b5cf6','#14b8a6'];
function getAvatarColor(id) { let h=0; for(let i=0;i<id.length;i++) h=id.charCodeAt(i)+((h<<5)-h); return avatarColors[Math.abs(h)%avatarColors.length]; }
function getInitial(name) { return (name||'?')[0].toUpperCase(); }

// Utils
function esc(s) { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function relativeTime(ts) {
  const s=Math.floor((Date.now()-ts)/1000);
  if(s<60) return 'just now'; if(s<3600) return Math.floor(s/60)+'m ago';
  if(s<86400) return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago';
}
function fullTime(ts) { return new Date(ts).toLocaleString(); }
function timeGroup(ts) {
  const d=new Date(ts), now=new Date();
  if(d.toDateString()===now.toDateString()) return 'Today';
  const y=new Date(now); y.setDate(y.getDate()-1);
  if(d.toDateString()===y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'});
}

// Toast
function toast(msg, type='info') {
  const t=document.createElement('div'); t.className='toast'+(type==='error'?' error':type==='success'?' success':'');
  t.textContent=msg; document.getElementById('toasts').appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

// Audio
let audioCtx=null;
function playBeep() { try { if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); o.frequency.value=800; g.gain.value=0.08; o.start(); o.stop(audioCtx.currentTime+0.08); } catch{} }
function playUrgentBeep() { try { if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)(); [800,1000,800].forEach((f,i)=>{ const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); o.frequency.value=f; g.gain.value=0.12; o.start(audioCtx.currentTime+i*0.15); o.stop(audioCtx.currentTime+i*0.15+0.1); }); } catch{} }

// Format content
function formatContent(c) {
  let h=esc(c);
  h=h.replace(/\\\`\\\`\\\`(\\w*?)\\n([\\s\\S]*?)\\\`\\\`\\\`/g,(_,lang,code)=>{
    const l=lang?'<div class="code-lang">'+lang+'</div>':'';
    return l+'<pre class="code-block"><code>'+code+'</code></pre>';
  });
  h=h.replace(/\\\`([^\\\`]+)\\\`/g,'<code style="background:var(--surface);padding:1px 4px;border-radius:3px;font-size:13px">$1</code>');
  h=h.replace(/@([a-zA-Z0-9_-]+)/g,'<span class="mention">@$1</span>');
  h=h.replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>');
  return h;
}

// Loading skeletons
function showSkeleton(el) {
  el.innerHTML = Array(5).fill(0).map(()=>
    '<div class="skeleton-msg"><div class="skeleton skeleton-avatar"></div><div class="skeleton-lines"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line long"></div><div class="skeleton skeleton-line medium"></div></div></div>'
  ).join('');
}

// ===== SIDEBAR =====
function toggleSidebar() { document.getElementById('left-sidebar').classList.toggle('open'); }

// ===== RIGHT SIDEBAR =====
function toggleRight() {
  rightOpen=!rightOpen;
  document.body.classList.toggle('right-open',rightOpen);
  document.getElementById('right-toggle').classList.toggle('active',rightOpen);
  if(rightOpen) { loadTasks(); loadWorkflows(); loadMemory(); loadKnowledge(); }
}
function switchRightTab(tab,btn) {
  document.querySelectorAll('.right-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.right-panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('panel-'+tab).classList.add('active');
}

// ===== CHANNELS =====
async function loadChannels() {
  try {
    const res=await fetch('/channels?agent='+myId,{headers:H}); const chs=await res.json();
    const el=document.getElementById('channel-list');
    const existing=new Set(['general','tasks','alerts']);
    chs.forEach(ch=>{
      if(!existing.has(ch.id)){
        const btn=document.createElement('button'); btn.className='ch-btn'; btn.dataset.ch=ch.id;
        btn.innerHTML=(ch.is_private?'<span class="ch-hash">🔒</span> ':'<span class="ch-hash">#</span> ')+esc(ch.id);
        btn.addEventListener('click',()=>switchChannel(ch.id,btn));
        el.appendChild(btn);
      }
    });
  } catch{}
}
function showCreateChannel() {
  const name=prompt('Channel name:'); if(!name) return;
  const priv=confirm('Make it private?');
  const agents=priv?prompt('Invite agents (comma-separated):'):'';
  const allowed=agents?agents.split(',').map(s=>s.trim()).filter(Boolean):[];
  fetch('/channels',{method:'POST',headers:H,body:JSON.stringify({id:name.toLowerCase().replace(/[^a-z0-9-]/g,'-'),name,is_private:priv,created_by:myId,allowed_agents:allowed})})
    .then(r=>r.json()).then(d=>{ toast('Channel created!'+(d.invite_code?' Code: '+d.invite_code:''),'success'); loadChannels(); })
    .catch(e=>toast('Error: '+e,'error'));
}
function switchChannel(ch,btn) {
  const msgs=document.getElementById('messages');
  msgs.classList.add('fade-out');
  setTimeout(()=>{
    document.querySelectorAll('.ch-btn').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    channel=ch;
    document.getElementById('ch-name').textContent=ch;
    document.getElementById('msg-input').placeholder='Message #'+ch+' — Enter to send, Shift+Enter for newline';
    seenIds.clear(); msgCache.clear();
    loadMessages(); loadTasks(); loadChannelTopic();
    msgs.classList.remove('fade-out'); msgs.classList.add('fade-in');
    setTimeout(()=>msgs.classList.remove('fade-in'),150);
  },150);
}

async function loadChannelTopic() {
  try {
    const res=await fetch('/channels/'+channel+'/summary',{headers:H}); const d=await res.json();
    const bar=document.getElementById('topic-bar');
    if(d.topic){ document.getElementById('topic-text').textContent=d.topic; bar.classList.add('show'); }
    else bar.classList.remove('show');
  } catch{}
}

// ===== AGENTS =====
async function loadAgents() {
  try {
    const [aRes,pRes]=await Promise.all([fetch('/agents',{headers:H}),fetch('/presence',{headers:H}).catch(()=>({json:()=>[]}))]);
    const agents=await aRes.json(); const pList=await pRes.json();
    const pMap={}; (Array.isArray(pList)?pList:[]).forEach(p=>pMap[p.agent_id]=p);
    agentCache=agents;
    let onlineCount=0;
    const el=document.getElementById('agent-list');
    el.innerHTML=agents.map(a=>{
      const p=pMap[a.id]; const status=p?(p.effective_status||p.status||'offline'):(a.status||(a.online?'online':'offline'));
      if(status==='online') onlineCount++;
      const statusText=p&&p.status_text?esc(p.status_text):'';
      const color=getAvatarColor(a.id);
      const taskCount=a.current_load>0?'<span class="agent-task-count">'+a.current_load+'</span>':'';
      return '<div class="agent-card" onclick="showAgentPopup(event,\\''+esc(a.id)+'\\')">'
        +'<div class="agent-avatar" style="background:'+color+'">'+getInitial(a.name||a.id)+'<div class="presence-dot '+esc(status)+'"></div></div>'
        +'<div class="agent-info"><div class="agent-name">'+esc(a.name||a.id)+'</div>'
        +(statusText?'<div class="agent-status-text">'+statusText+'</div>':'')
        +'</div><div class="agent-badges">'+taskCount+'</div></div>';
    }).join('');
    document.getElementById('agent-count').textContent=onlineCount;
  } catch{}
}

function showAgentPopup(e, agentId) {
  const a=agentCache.find(x=>x.id===agentId); if(!a) return;
  const popup=document.getElementById('agent-popup');
  const color=getAvatarColor(a.id);
  popup.innerHTML='<div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">'
    +'<div class="agent-avatar" style="background:'+color+';width:40px;height:40px;font-size:18px">'+getInitial(a.name||a.id)+'</div>'
    +'<div><h4>'+esc(a.name||a.id)+'</h4><div class="popup-field">'+esc(a.platform||'unknown')+'</div></div></div>'
    +(a.capabilities?'<div class="popup-field"><b>Capabilities:</b></div><div class="cap-list">'+a.capabilities.map(c=>'<span class="cap-tag">'+esc(c)+'</span>').join('')+'</div>':'')
    +'<div class="popup-field" style="margin-top:8px"><b>Load:</b> '+esc(String(a.current_load||0))+' tasks</div>';
  popup.style.left=Math.min(e.clientX,window.innerWidth-300)+'px';
  popup.style.top=Math.min(e.clientY,window.innerHeight-200)+'px';
  popup.classList.add('show');
  setTimeout(()=>document.addEventListener('click',closeAgentPopup,{once:true}),10);
}
function closeAgentPopup() { document.getElementById('agent-popup').classList.remove('show'); }

// ===== MESSAGES =====
let lastGroup='';
async function loadMessages() {
  const el=document.getElementById('messages');
  showSkeleton(el);
  try {
    const res=await fetch('/messages?channel='+channel+'&limit=50',{headers:H}); const msgs=await res.json();
    el.innerHTML=''; seenIds.clear(); msgCache.clear(); lastGroup='';
    if(!msgs.length) { el.innerHTML='<div class="empty-state"><div class="emoji">👋</div><div class="title">No messages yet</div><div class="subtitle">Say hello!</div></div>'; return; }
    msgs.forEach(m=>{msgCache.set(m.id,m); appendMsg(m,false);});
    el.scrollTop=el.scrollHeight; autoScroll=true;
    loadPinned();
  } catch(e){ el.innerHTML='<div class="empty-state"><div class="emoji">⚠️</div><div class="title">Failed to load</div></div>'; }
}

// Auto-scroll detection
document.getElementById('messages').addEventListener('scroll',function(){
  const el=this; autoScroll=(el.scrollHeight-el.scrollTop-el.clientHeight)<60;
});

function appendMsg(m, isNew=true) {
  if(m.channel&&m.channel!==channel) return;
  if(m.type==='connected'||m.type==='typing'||m.type==='barrier_cleared') return;
  if(m.id&&seenIds.has(m.id)) return;
  if(m.id) seenIds.add(m.id);
  if(m.id) msgCache.set(m.id,m);

  const el=document.getElementById('messages');
  // Remove empty state if present
  const empty=el.querySelector('.empty-state'); if(empty) empty.remove();

  // Time separator
  const group=timeGroup(m.created_at);
  if(group!==lastGroup) {
    lastGroup=group;
    const sep=document.createElement('div'); sep.className='time-separator';
    sep.innerHTML='<span>'+esc(group)+'</span>'; el.appendChild(sep);
  }

  const div=document.createElement('div'); div.id='msg-'+m.id;
  const isReply=m.reply_to?' reply':'';
  const priorityClass=(m.priority==='urgent'||m.priority==='high')?' priority-'+m.priority:'';
  div.className='msg'+isReply+priorityClass;

  const badge=m.type&&m.type!=='chat'?'<span class="msg-badge badge-'+m.type+'">'+esc(m.type)+'</span>':'';
  const receipt=m.read_at?'<span class="msg-receipt read" title="Read">✓✓</span>':m.delivered_at?'<span class="msg-receipt delivered">✓✓</span>':'<span class="msg-receipt sent">✓</span>';
  const readInfo=m.read_at&&m.read_by?'<div class="msg-read-info">Read by '+esc(m.read_by)+' • '+relativeTime(m.read_at)+'</div>':'';

  let replyRef='';
  if(m.reply_to){ const p=msgCache.get(m.reply_to); const pn=p?p.from_agent:'...'; const pp=p?(p.content||'').slice(0,50):''; replyRef='<div class="reply-ref" onclick="scrollToMsg(\\''+m.reply_to+'\\')">↩ '+esc(pn)+': '+esc(pp)+'</div>'; }

  let contentHtml='';
  if(m.type==='handoff'&&m.metadata){
    try{ const meta=typeof m.metadata==='string'?JSON.parse(m.metadata):m.metadata;
      contentHtml='<div class="handoff-card"><h4>🤝 Handoff</h4>';
      if(meta.from_task) contentHtml+='<div class="field"><label>Task: </label>'+esc(meta.from_task)+'</div>';
      if(meta.to_agent) contentHtml+='<div class="field"><label>To: </label><span class="mention">@'+esc(meta.to_agent)+'</span></div>';
      if(meta.context) contentHtml+='<div class="field"><label>Context: </label>'+esc(meta.context)+'</div>';
      contentHtml+='</div>';
    } catch{ contentHtml=formatContent(m.content||''); }
  } else { contentHtml=formatContent(m.content||''); }

  const color=getAvatarColor(m.from_agent);
  div.innerHTML='<div class="msg-avatar" style="background:'+color+'">'+getInitial(m.from_agent)+'</div>'
    +'<div class="msg-body">'+replyRef
    +'<div class="msg-meta"><span class="msg-sender" style="color:'+color+'">'+esc(m.from_agent)+'</span>'+badge
    +'<span class="msg-time" title="'+fullTime(m.created_at)+'">'+relativeTime(m.created_at)+'</span>'+receipt+'</div>'
    +'<div class="msg-content">'+contentHtml+'</div>'+readInfo+'</div>'
    +'<div class="msg-actions"><button onclick="setReply(\\''+m.id+'\\',\\''+esc(m.from_agent)+'\\')">↩</button><button onclick="pinMsg(\\''+m.id+'\\')">📌</button></div>';

  el.appendChild(div);
  if(autoScroll) el.scrollTop=el.scrollHeight;

  // ACK
  if(isNew&&m.from_agent!==myId&&!m.read_at){
    fetch('/messages/'+m.id+'/ack',{method:'POST',headers:H,body:JSON.stringify({status:'read'})}).catch(()=>{});
  }
}

function scrollToMsg(id) {
  const el=document.getElementById('msg-'+id);
  if(el){ el.scrollIntoView({behavior:'smooth',block:'center'}); el.style.background='var(--surface)'; setTimeout(()=>el.style.background='',1500); }
}

// Reply
function setReply(id,name) { replyTo=id; document.getElementById('reply-to-name').textContent=name; document.getElementById('reply-indicator').classList.add('show'); document.getElementById('msg-input').focus(); }
function cancelReply() { replyTo=null; document.getElementById('reply-indicator').classList.remove('show'); }

// Pin
async function pinMsg(id) { await fetch('/messages/'+id+'/pin',{method:'POST',headers:H,body:JSON.stringify({pinned:true})}); loadPinned(); toast('Message pinned','success'); }
async function loadPinned() {
  try {
    const res=await fetch('/messages?channel='+channel+'&limit=200',{headers:H}); const msgs=await res.json();
    const pinned=msgs.filter(m=>m.pinned);
    const area=document.getElementById('pinned-area'); const list=document.getElementById('pinned-list');
    document.getElementById('pin-count').textContent=pinned.length?'('+pinned.length+')':'';
    if(!pinned.length){ area.classList.remove('show'); return; }
    list.innerHTML=pinned.map(m=>'<div class="pinned-msg"><b>'+esc(m.from_agent)+':</b> '+esc((m.content||'').slice(0,80))+'</div>').join('');
  } catch{}
}
function togglePinned() { document.getElementById('pinned-area').classList.toggle('show'); }

// Search
function toggleSearch() { const bar=document.getElementById('search-bar'); bar.classList.toggle('show'); if(bar.classList.contains('show')) document.getElementById('search-input').focus(); }
let searchDebounce=null;
function searchMessages() {
  clearTimeout(searchDebounce);
  searchDebounce=setTimeout(async()=>{
    const q=document.getElementById('search-input').value.trim();
    if(!q){ loadMessages(); return; }
    const res=await fetch('/messages?channel='+channel+'&limit=50&search='+encodeURIComponent(q),{headers:H});
    const msgs=await res.json(); const el=document.getElementById('messages');
    el.innerHTML=''; seenIds.clear(); lastGroup='';
    msgs.forEach(m=>appendMsg(m,false));
  },300);
}

// Summary
async function showSummary() {
  const res=await fetch('/channels/'+channel+'/summary',{headers:H}); const d=await res.json();
  const el=document.getElementById('summary-content');
  let html=d.topic?'<div style="margin-bottom:12px;padding:8px;background:var(--surface);border-radius:6px"><b>Topic:</b> '+esc(d.topic)+'</div>':'';
  html+=d.summary.map(s=>'<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:13px"><b>'+esc(s.from)+'</b> <span style="color:var(--text-muted)">'+relativeTime(s.time)+'</span><br>'+esc(s.content)+'</div>').join('');
  el.innerHTML=html;
  document.getElementById('summary-modal').classList.add('show');
  document.getElementById('overlay').classList.add('show');
}
function closeModals() { document.querySelectorAll('.modal,.agent-popup').forEach(m=>m.classList.remove('show')); document.getElementById('overlay').classList.remove('show'); }

// ===== SEND =====
async function sendMsg() {
  const input=document.getElementById('msg-input'); const text=input.value.trim(); if(!text) return;
  const type=document.getElementById('msg-type').value;
  const priority=document.getElementById('msg-priority').value;
  const body={from_agent:myId,channel,type,content:text,priority};
  if(replyTo) body.reply_to=replyTo;

  // Optimistic UI
  const tempId='temp-'+Date.now();
  appendMsg({id:tempId,from_agent:myId,channel,type,content:text,created_at:Date.now(),reply_to:replyTo,priority},false);
  input.value=''; input.style.height='auto'; cancelReply();

  try {
    const res=await fetch('/messages',{method:'POST',headers:H,body:JSON.stringify(body)});
    const result=await res.json();
    // Replace temp msg
    const temp=document.getElementById('msg-'+tempId);
    if(temp&&result.message) temp.id='msg-'+result.message.id;
  } catch(e){ toast('Failed to send','error'); }
}

// ===== TYPING =====
function sendTyping() { fetch('/agents/'+myId+'/typing',{method:'POST',headers:H}).catch(()=>{}); }
let typingClear=null;
function showTyping(agent) {
  const el=document.getElementById('typing-indicator');
  el.innerHTML='<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;background:var(--surface);border-radius:12px;border:1px solid var(--border)"><span style="width:20px;height:20px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff">'+getInitial(agent)+'</span><span>'+esc(agent)+' is typing</span><span class="typing-dots"><span></span><span></span><span></span></span></span>';
  clearTimeout(typingClear);
  typingClear=setTimeout(()=>el.innerHTML='',4000);
}
// Poll typing status as fallback (SSE may miss events)
setInterval(async()=>{
  try{
    const r=await fetch(BASE+'/agents/typing',{headers:authH()});
    if(r.ok){const agents=await r.json();if(agents.length>0)agents.forEach(a=>showTyping(a));}
  }catch{}
},2000);

// ===== @ MENTION =====
function checkMention() {
  const input=document.getElementById('msg-input');
  const val=input.value; const cur=input.selectionStart;
  const before=val.slice(0,cur); const match=before.match(/@([a-zA-Z0-9_-]*)$/);
  const popup=document.getElementById('mention-popup');
  if(!match){ popup.classList.remove('show'); return; }
  const q=match[1].toLowerCase();
  const filtered=agentCache.filter(a=>(a.name||a.id).toLowerCase().includes(q)).slice(0,6);
  if(!filtered.length){ popup.classList.remove('show'); return; }
  popup.innerHTML=filtered.map((a,i)=>{
    const color=getAvatarColor(a.id);
    return '<div class="mention-item'+(i===0?' selected':'')+'" onclick="insertMention(\\''+esc(a.id)+'\\')">'
      +'<div style="width:24px;height:24px;border-radius:50%;background:'+color+';display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:700">'+getInitial(a.name||a.id)+'</div>'
      +esc(a.name||a.id)+'</div>';
  }).join('');
  popup.classList.add('show');
}
function insertMention(id) {
  const input=document.getElementById('msg-input');
  const cur=input.selectionStart; const val=input.value;
  const before=val.slice(0,cur).replace(/@[a-zA-Z0-9_-]*$/,'@'+id+' ');
  input.value=before+val.slice(cur); input.focus();
  document.getElementById('mention-popup').classList.remove('show');
}

// ===== TASKS =====
async function loadTasks() {
  let url='/tasks?channel='+channel;
  if(taskFilter==='archived') url='/tasks/archived?channel='+channel;
  else if(taskFilter==='ready') url='/tasks/ready';
  else if(taskFilter==='blocked') url='/tasks/blocked';
  try {
    const res=await fetch(url,{headers:H}); const tasks=await res.json();
    const el=document.getElementById('task-list');
    if(!tasks.length){ el.innerHTML='<div class="empty-state" style="padding:24px"><div class="emoji">📋</div><div class="title">No tasks</div><div class="subtitle">Create one!</div></div>'; return; }
    el.innerHTML=tasks.map(t=>{
      const unclaimed=!t.assigned_to?'unclaimed':'';
      const doneCheck=t.status==='done'?'<span class="task-done-check">✓</span>':'';
      const deps=t.depends_on?'<div class="task-deps">⛓ '+esc(t.depends_on)+'</div>':'';
      const claimBtn=!t.assigned_to?'<button class="claim-btn" onclick="event.stopPropagation();claimTask(\\''+t.id+'\\')">Claim</button>':'';
      const progress=t.status==='in_progress'?'<div class="task-progress"><div class="task-progress-bar" style="width:50%"></div></div>':'';
      return '<div class="task-item '+unclaimed+'" onclick="toggleTaskDetails(\\''+t.id+'\\')">'
        +'<div class="task-header">'+doneCheck+'<span class="task-title">'+esc(t.title)+'</span>'+claimBtn+'</div>'
        +'<div class="task-meta-row"><span class="task-status '+t.status+'">'+t.status+'</span><span class="task-priority '+(t.priority||'medium')+'">'+(t.priority||'medium')+'</span>'
        +'<span class="task-assignee">→ '+esc(t.assigned_to||'unassigned')+'</span></div>'
        +deps+progress
        +'<div class="task-details" id="td-'+t.id+'">'+esc(t.description||'No description')
        +'<div style="margin-top:6px"><button class="claim-btn" onclick="event.stopPropagation();cycleTaskStatus(\\''+t.id+'\\',\\''+t.status+'\\')">→ Next Status</button></div></div></div>';
    }).join('');
  } catch{ document.getElementById('task-list').innerHTML='<div class="empty-state"><div class="emoji">⚠️</div><div class="subtitle">Failed to load tasks</div></div>'; }
}
function toggleTaskDetails(id) { const el=document.getElementById('td-'+id); if(el) el.classList.toggle('show'); }
function filterTasks(f,btn) { taskFilter=f; document.querySelectorAll('.task-filter-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); loadTasks(); }
function toggleTaskForm() { document.getElementById('task-form').classList.toggle('show'); }
async function createTask() {
  const title=document.getElementById('task-title').value.trim(); if(!title) return;
  const deps=document.getElementById('task-deps').value.trim();
  const body={title,description:document.getElementById('task-desc').value.trim()||undefined,assigned_to:document.getElementById('task-assign').value.trim()||undefined,created_by:myId,priority:document.getElementById('task-priority-sel').value,channel,depends_on:deps?deps.split(',').map(s=>s.trim()):undefined};
  await fetch('/tasks',{method:'POST',headers:H,body:JSON.stringify(body)});
  document.getElementById('task-title').value=''; document.getElementById('task-desc').value=''; document.getElementById('task-assign').value=''; document.getElementById('task-deps').value='';
  toggleTaskForm(); loadTasks(); toast('Task created','success');
}
async function claimTask(id) { await fetch('/tasks/'+id+'/claim',{method:'POST',headers:H,body:JSON.stringify({agent_id:myId})}); loadTasks(); toast('Task claimed','success'); }
const statusCycle={pending:'in_progress',in_progress:'done',done:'pending',blocked:'pending',archived:'pending'};
async function cycleTaskStatus(id,current) { await fetch('/tasks/'+id,{method:'PATCH',headers:H,body:JSON.stringify({status:statusCycle[current]||'pending',updated_by:myId})}); loadTasks(); }

// ===== WORKFLOWS =====
async function loadWorkflows() {
  try {
    const res=await fetch('/workflows',{headers:H}); const all=await res.json();
    const el=document.getElementById('workflow-list');
    if(!all.length){ el.innerHTML='<div class="empty-state" style="padding:24px"><div class="emoji">⚡</div><div class="title">No workflows</div></div>'; return; }
    el.innerHTML=all.slice(0,10).map(w=>'<div class="wf-item"><div style="display:flex;gap:8px;align-items:center"><span class="wf-status '+(w.status||'pending')+'">'+esc(w.status||'pending')+'</span><span class="wf-name">'+esc(w.name)+'</span></div></div>').join('');
  } catch{ document.getElementById('workflow-list').innerHTML='<div class="empty-state" style="padding:24px"><div class="subtitle">No workflows</div></div>'; }
}

// ===== MEMORY =====
async function loadMemory() {
  try {
    const res=await fetch('/memory',{headers:H}); const items=await res.json();
    const el=document.getElementById('memory-list');
    if(!items.length){ el.innerHTML='<div class="empty-state" style="padding:24px"><div class="emoji">🧠</div><div class="title">No shared memory</div></div>'; return; }
    el.innerHTML=items.map(m=>'<div class="mem-item"><div class="mem-key">'+esc(m.key)+'</div><div class="mem-val">'+esc(m.value)+'</div><div class="mem-by">'+esc(m.updated_by||'')+'</div></div>').join('');
  } catch{}
}

// ===== KNOWLEDGE =====
async function loadKnowledge() {
  try {
    const res=await fetch('/knowledge',{headers:H}); const items=await res.json();
    const el=document.getElementById('knowledge-list');
    if(!items.length){ el.innerHTML='<div class="empty-state" style="padding:24px"><div class="emoji">📚</div><div class="title">No knowledge entries</div></div>'; return; }
    el.innerHTML=items.slice(0,20).map(k=>'<div class="knowledge-item"><div class="k-title">'+esc(k.title||k.key||'Untitled')+'</div><div class="k-content">'+esc((k.content||'').slice(0,100))+'</div>'
      +(k.tags?'<div class="k-tags">'+k.tags.map(t=>'<span class="k-tag">'+esc(t)+'</span>').join('')+'</div>':'')+'</div>').join('');
  } catch{ document.getElementById('knowledge-list').innerHTML='<div class="empty-state" style="padding:24px"><div class="subtitle">No knowledge</div></div>'; }
}

// ===== SSE =====
function connectSSE() {
  if(sse) sse.close();
  sse=new EventSource('/stream?agent='+myId+'&key='+API_KEY);
  const handleMsg=(e)=>{
    try {
      const m=JSON.parse(e.data);
      if(m.type==='typing'){ showTyping(m.agent); return; }
      if(m.type==='barrier_cleared'){ loadTasks(); return; }
      appendMsg(m);
      if(m.from_agent!==myId){ m.priority==='urgent'?playUrgentBeep():playBeep(); }
    } catch{}
  };
  sse.addEventListener('message',handleMsg);
  sse.addEventListener('urgent',handleMsg);
  sse.onerror=()=>{ sse.close(); sse=null; setTimeout(connectSSE,3000); };
}

// Polling fallback
setInterval(async()=>{
  try {
    const res=await fetch('/messages?channel='+channel+'&limit=10',{headers:H}); const msgs=await res.json();
    msgs.forEach(m=>appendMsg(m));
  } catch{}
},3000);

// ===== KEYBOARD =====
const input=document.getElementById('msg-input');
input.addEventListener('keydown',(e)=>{
  if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMsg(); }
  else sendTyping();
});
input.addEventListener('input',()=>{ input.style.height='auto'; input.style.height=Math.min(input.scrollHeight,120)+'px'; checkMention(); });

document.addEventListener('keydown',(e)=>{
  if(e.key==='k'&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); toggleSearch(); }
  if(e.key==='Escape') { closeModals(); document.getElementById('search-bar').classList.remove('show'); document.getElementById('mention-popup').classList.remove('show'); }
});

document.getElementById('send-btn').addEventListener('click',sendMsg);

// Update relative times
setInterval(()=>{
  document.querySelectorAll('.msg-time').forEach(el=>{
    const ts=el.getAttribute('title'); if(ts){ const d=new Date(ts).getTime(); if(!isNaN(d)) el.textContent=relativeTime(d); }
  });
},30000);

// Refresh agents periodically
setInterval(loadAgents,30000);

// ===== INIT =====
async function init() {
  await fetch('/agents/register',{method:'POST',headers:H,body:JSON.stringify({id:myId,name:myName,platform:'web'})}).catch(()=>{});
  loadAgents(); loadMessages(); connectSSE(); loadChannels(); loadChannelTopic();
}
init();
</script>
</body>
</html>`;
