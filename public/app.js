let currentTaskId = null;
let currentTasks = [];

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
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
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
async function loadTasks(isNew = false) {
  try {
    const tasks = await apiCall('GET', '/api/tasks');
    currentTasks = tasks;
    renderTasks(tasks, isNew);
  } catch (err) {
    showError(err.message);
  }
}

function renderTasks(tasks, isNew = false) {
  const container = document.getElementById('tasksContainer');

  if (tasks.length === 0) {
    container.innerHTML = '<div class="empty-state">タスクはまだありません。新しいタスクを作成してください。</div>';
    return;
  }

  container.innerHTML = tasks.map((task, index) => `
    <div class="task-item ${isNew && index === 0 ? 'fade-in' : ''}">
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
        ${task.share_permission === 'owner' || task.share_permission === 'edit'
    ? `<button class="task-edit-btn" data-task-id="${task.id}" data-version="${task.version}">編集</button>`
    : ''}
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
    loadTasks(true);
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
    const taskElement = document.querySelector(`[data-task-id="${taskId}"]`).closest('.task-item');
    taskElement?.classList.add('slide-out');

    await new Promise(resolve => setTimeout(resolve, 300));

    await apiCall('DELETE', `/api/tasks/${taskId}`);
    showSuccess('タスクを削除しました');
    loadTasks();
  } catch (err) {
    showError(err.message);
    loadTasks();
  }
}

function enterEditMode(taskElement, task) {
  taskElement.classList.add('edit-mode');
  const taskContent = taskElement.querySelector('.task-content');

  taskContent.innerHTML = `
    <div>
      <input type="text" class="inline-input edit-title" value="${escapeHtml(task.title)}" placeholder="タスク名">
      <div class="inline-error error-title" style="display:none;"></div>
    </div>
    <div style="margin-top: 8px;">
      <input type="date" class="inline-input edit-due-date" value="${task.due_date || ''}" placeholder="期限">
      <div class="inline-error error-due-date" style="display:none;"></div>
    </div>
    <div style="margin-top: 8px; display: flex; gap: 8px;">
      <button class="edit-confirm-btn">確定</button>
      <button class="edit-cancel-btn">キャンセル</button>
    </div>
  `;

  const titleInput = taskContent.querySelector('.edit-title');
  titleInput.focus();
  titleInput.select();

  // Bind event handlers
  const confirmBtn = taskContent.querySelector('.edit-confirm-btn');
  const cancelBtn = taskContent.querySelector('.edit-cancel-btn');
  const dueDateInput = taskContent.querySelector('.edit-due-date');

  const handleSubmit = async () => {
    const newTitle = titleInput.value.trim();
    const newDueDate = dueDateInput.value || null;

    // Validate locally
    if (!newTitle) {
      taskContent.querySelector('.error-title').textContent = 'タスク名は必須です';
      taskContent.querySelector('.error-title').style.display = 'block';
      titleInput.focus();
      return;
    }
    if (newTitle.length > 200) {
      taskContent.querySelector('.error-title').textContent = '200文字以内で入力してください';
      taskContent.querySelector('.error-title').style.display = 'block';
      titleInput.focus();
      return;
    }
    if (newDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(newDueDate)) {
      taskContent.querySelector('.error-due-date').textContent = 'YYYY-MM-DD形式で入力してください';
      taskContent.querySelector('.error-due-date').style.display = 'block';
      dueDateInput.focus();
      return;
    }

    // Submit to server
    try {
      await apiCall('PUT', `/api/tasks/${task.id}`, {
        title: newTitle,
        due_date: newDueDate,
        version: task.version
      });

      showSuccess('タスクを更新しました');
      loadTasks();
    } catch (err) {
      if (err.status === 400) {
        if (err.message.includes('title')) {
          taskContent.querySelector('.error-title').textContent = err.message;
          taskContent.querySelector('.error-title').style.display = 'block';
        } else if (err.message.includes('due_date')) {
          taskContent.querySelector('.error-due-date').textContent = err.message;
          taskContent.querySelector('.error-due-date').style.display = 'block';
        } else {
          showError(err.message);
        }
      } else if (err.status === 409) {
        showError('他のユーザーによる編集が検出されました。ページを再読込してください。');
        loadTasks();
      } else {
        showError(err.message);
        loadTasks();
      }
    }
  };

  const handleCancel = () => {
    cancelEdit(taskElement, task);
  };

  confirmBtn.addEventListener('click', handleSubmit);
  cancelBtn.addEventListener('click', handleCancel);
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') handleCancel();
  });
  dueDateInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') handleCancel();
  });
}

function cancelEdit(taskElement, task) {
  taskElement.classList.remove('edit-mode');
  const taskContent = taskElement.querySelector('.task-content');
  taskContent.innerHTML = `
    <div class="task-title ${task.completed ? 'completed' : ''}">${escapeHtml(task.title)}</div>
    <div class="task-meta">
      <span class="task-meta-item">ID: ${task.id}</span>
      ${task.due_date ? `<span class="task-meta-item">期限: ${task.due_date}</span>` : ''}
      ${task.share_permission && task.share_permission !== 'owner'
    ? `<span class="task-share-badge">${task.owner_username} さんから${task.share_permission === 'edit' ? '編集可' : '閲覧'}で共有</span>`
    : ''}
    </div>
  `;
}

function openShareModal(taskId) {
  currentTaskId = taskId;
  const modal = document.getElementById('shareModal');
  modal.classList.add('active');
  const content = modal.querySelector('.modal-content');
  content?.classList.add('fade-scale');
  document.getElementById('shareUsername').focus();
}

function closeShareModal() {
  currentTaskId = null;
  const modal = document.getElementById('shareModal');
  modal.classList.remove('active');
  modal.querySelector('.modal-content')?.classList.remove('fade-scale');
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
  const editBtn = e.target.closest('.task-edit-btn');
  if (editBtn) {
    const taskId = Number(editBtn.dataset.taskId);
    const taskElement = editBtn.closest('.task-item');
    const task = currentTasks.find(t => t.id === taskId);
    if (task) {
      enterEditMode(taskElement, task);
    }
    return;
  }

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
