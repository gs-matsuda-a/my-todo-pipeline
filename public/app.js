let currentTaskId = null;

// API helpers
async function apiCall(method, path, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

// Auth functions
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  try {
    await apiCall('POST', '/api/login', { username, password });
    showDashboard();
    loadTasks();
  } catch (err) {
    showError(err.message);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('registerUsername').value;
  const password = document.getElementById('registerPassword').value;

  try {
    await apiCall('POST', '/api/register', { username, password });
    await apiCall('POST', '/api/login', { username, password });
    showDashboard();
    loadTasks();
  } catch (err) {
    showError(err.message);
  }
}

async function handleLogout() {
  try {
    await apiCall('POST', '/api/logout');
    showAuth();
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
  } catch (err) {
    showError(err.message);
  }
}

// UI functions
function showAuth() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('dashboardScreen').classList.add('hidden');
}

async function showDashboard() {
  const user = await apiCall('GET', '/api/me');
  document.getElementById('currentUsername').textContent = user.username;

  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('dashboardScreen').classList.remove('hidden');
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  box.innerHTML = `<div class="error-message">${msg}</div>`;
  setTimeout(() => { box.innerHTML = ''; }, 4000);
}

function showSuccess(msg) {
  const box = document.getElementById('successBox');
  box.innerHTML = `<div class="success-message">${msg}</div>`;
  setTimeout(() => { box.innerHTML = ''; }, 3000);
}

// Task functions
async function loadTasks() {
  try {
    const tasks = await apiCall('GET', '/api/tasks');
    renderTasks(tasks);
  } catch (err) {
    showError(err.message);
  }
}

function renderTasks(tasks) {
  const container = document.getElementById('tasksContainer');

  if (tasks.length === 0) {
    container.innerHTML = '<div class="empty-state">タスクはまだありません。新しいタスクを作成してください。</div>';
    return;
  }

  container.innerHTML = tasks.map(task => `
    <div class="task-item">
      <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}
             data-task-id="${task.id}" data-version="${task.version}">
      <div class="task-content">
        <div class="task-title ${task.completed ? 'completed' : ''}">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          <span class="task-meta-item">ID: ${task.id}</span>
          ${task.due_date ? `<span class="task-meta-item">期限: ${task.due_date}</span>` : ''}
          ${task.share_permission && task.share_permission !== 'owner'
    ? `<span class="task-share-badge">${task.owner_username} さんから${task.share_permission === 'edit' ? '編集可' : '閲覧'}で共有</span>`
    : ''}
        </div>
      </div>
      <div class="task-actions">
        ${task.share_permission === 'owner'
    ? `<button class="task-share-btn" data-task-id="${task.id}">共有</button>`
    : ''}
        ${task.share_permission === 'owner'
    ? `<button class="task-delete-btn" data-task-id="${task.id}">削除</button>`
    : ''}
      </div>
    </div>
  `).join('');
}

async function addTask() {
  const title = document.getElementById('newTaskTitle').value.trim();
  if (!title) return;

  try {
    await apiCall('POST', '/api/tasks', { title });
    document.getElementById('newTaskTitle').value = '';
    showSuccess('タスクを作成しました');
    loadTasks();
  } catch (err) {
    showError(err.message);
  }
}

async function toggleTask(taskId, completed, version) {
  try {
    await apiCall('PUT', `/api/tasks/${taskId}`, { completed: completed ? 1 : 0, version });
    showSuccess(completed ? 'タスクを完了しました' : 'タスクを未完了にしました');
    loadTasks();
  } catch (err) {
    showError(err.message);
    loadTasks(); // Reload to sync state
  }
}

async function deleteTask(taskId) {
  if (!confirm('このタスクを削除しますか？')) return;

  try {
    await apiCall('DELETE', `/api/tasks/${taskId}`);
    showSuccess('タスクを削除しました');
    loadTasks();
  } catch (err) {
    showError(err.message);
  }
}

function openShareModal(taskId) {
  currentTaskId = taskId;
  document.getElementById('shareModal').classList.add('active');
  document.getElementById('shareUsername').focus();
}

function closeShareModal() {
  currentTaskId = null;
  document.getElementById('shareModal').classList.remove('active');
  document.getElementById('shareForm').reset();
}

async function handleShare(e) {
  e.preventDefault();
  const username = document.getElementById('shareUsername').value.trim();
  const permission = document.getElementById('sharePermission').value;

  try {
    await apiCall('POST', `/api/tasks/${currentTaskId}/share`, { username, permission });
    showSuccess(`${username} さんと共有しました`);
    closeShareModal();
    loadTasks();
  } catch (err) {
    showError(err.message);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Event listeners
document.getElementById('loginForm').addEventListener('submit', handleLogin);
document.getElementById('registerForm').addEventListener('submit', handleRegister);
document.getElementById('logoutBtn').addEventListener('click', handleLogout);
document.getElementById('addTaskBtn').addEventListener('click', addTask);
document.getElementById('newTaskTitle').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addTask();
});

document.getElementById('authToggleBtn').addEventListener('click', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const isLogin = !loginForm.classList.contains('hidden');

  if (isLogin) {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    document.getElementById('authToggleLabel').textContent = 'アカウント新規作成';
    document.getElementById('authToggleText').textContent = 'アカウントをお持ちですか？';
    document.getElementById('authToggleBtn').textContent = 'ログイン';
  } else {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    document.getElementById('authToggleLabel').textContent = 'アカウントをお持ちですか？ログインしてください';
    document.getElementById('authToggleText').textContent = 'アカウントをお持ちでないですか？';
    document.getElementById('authToggleBtn').textContent = '登録する';
  }
});

document.getElementById('shareForm').addEventListener('submit', handleShare);
document.getElementById('shareModalCancel').addEventListener('click', closeShareModal);

// Task list event delegation (CSP-safe: no inline onclick/onchange handlers)
document.getElementById('tasksContainer').addEventListener('change', (e) => {
  if (e.target.matches('.task-checkbox')) {
    const taskId = Number(e.target.dataset.taskId);
    const version = Number(e.target.dataset.version);
    toggleTask(taskId, e.target.checked, version);
  }
});

document.getElementById('tasksContainer').addEventListener('click', (e) => {
  const shareBtn = e.target.closest('.task-share-btn');
  if (shareBtn) {
    openShareModal(Number(shareBtn.dataset.taskId));
    return;
  }
  const deleteBtn = e.target.closest('.task-delete-btn');
  if (deleteBtn) {
    deleteTask(Number(deleteBtn.dataset.taskId));
  }
});

// Initialize
showAuth();
