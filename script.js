// ------------------- PASSWORD PROTECTION -------------------
(function () {
    const savedPassword = localStorage.getItem('notepadPassword');
    if (savedPassword) {
        const userPass = prompt("🔒 This notepad is password protected. Enter password:");
        if (userPass !== savedPassword) {
            document.body.innerHTML = "<h1 style='text-align:center;margin-top:50px;font-family:serif'>🔒 Access Denied</h1>";
            throw new Error("Unauthorized access");
        }
    }
})();

function managePassword() {
    const current = localStorage.getItem('notepadPassword');

    if (current) {
        // Already has a password — ask to verify first
        const verify = prompt("🔒 Enter your current password to continue:");
        if (verify !== current) {
            alert("❌ Incorrect password.");
            return;
        }
        const action = prompt("What would you like to do?\n\nType CHANGE to set a new password\nType REMOVE to remove password protection\nType CANCEL to go back:");
        if (!action) return;
        if (action.trim().toUpperCase() === 'REMOVE') {
            localStorage.removeItem('notepadPassword');
            alert("✅ Password removed. Your notepad is now open.");
        } else if (action.trim().toUpperCase() === 'CHANGE') {
            const newPass = prompt("Enter your new password:");
            if (!newPass || !newPass.trim()) { alert("Password can't be empty."); return; }
            const confirm = prompt("Confirm new password:");
            if (newPass !== confirm) { alert("❌ Passwords don't match."); return; }
            localStorage.setItem('notepadPassword', newPass.trim());
            alert("✅ Password updated!");
        }
    } else {
        // No password set yet
        const newPass = prompt("🔑 Set a password for your notepad:\n(Leave empty to cancel)");
        if (!newPass || !newPass.trim()) return;
        const confirm = prompt("Confirm your password:");
        if (newPass.trim() !== confirm) { alert("❌ Passwords don't match. Try again."); return; }
        localStorage.setItem('notepadPassword', newPass.trim());
        alert("✅ Password set! You'll be asked for it next time you open this notepad.");
    }
}

// ------------------- DATA MODEL -------------------
let notes = [];
let currentNoteId = null;
let reminders = []; // [{id, dateTime, message, timerId, triggered}]

function loadData() {
    const saved = localStorage.getItem('smartNotepadV2');
    if (saved) {
        notes = JSON.parse(saved);
    } else {
        notes = [{
            id: Date.now(),
            title: "Welcome!",
            body: "This is your first note. Write anything.\n\nTry voice typing, todos, reminders!",
            todos: []
        }];
    }
    if (notes.length === 0) createNewNote();

    const lastOpened = localStorage.getItem('lastNoteId');
    if (lastOpened && notes.find(n => n.id == lastOpened)) {
        currentNoteId = parseInt(lastOpened);
    } else {
        currentNoteId = notes[0].id;
    }

    // Load reminders
    const savedReminders = localStorage.getItem('smartNotepadReminders');
    if (savedReminders) {
        const parsed = JSON.parse(savedReminders);
        // Re-schedule any that haven't fired yet
        parsed.forEach(r => {
            const targetTime = new Date(r.dateTime).getTime();
            const now = Date.now();
            if (targetTime > now) {
                const timerId = setTimeout(() => triggerReminder(r.id), targetTime - now);
                reminders.push({ ...r, timerId, triggered: false });
            } else {
                reminders.push({ ...r, timerId: null, triggered: true });
            }
        });
    }

    renderNotesList();
    renderCurrentNote();
    renderReminderList();
    loadSettings();
}

function saveToLocal() {
    localStorage.setItem('smartNotepadV2', JSON.stringify(notes));
    localStorage.setItem('lastNoteId', currentNoteId);
}

function saveReminders() {
    const toSave = reminders.map(({ timerId, ...rest }) => rest);
    localStorage.setItem('smartNotepadReminders', JSON.stringify(toSave));
}

// ------------------- NOTES -------------------
function createNewNote() {
    const newId = Date.now();
    notes.push({ id: newId, title: "Untitled", body: "", todos: [] });
    currentNoteId = newId;
    saveToLocal();
    renderNotesList();
    renderCurrentNote();
}

function deleteNote(id) {
    if (notes.length === 1) {
        alert("You need at least one note. Create a new one first.");
        return;
    }
    notes = notes.filter(n => n.id !== id);
    if (currentNoteId === id) currentNoteId = notes[0].id;
    saveToLocal();
    renderNotesList();
    renderCurrentNote();
}

function renameNote(id, newTitle) {
    const note = notes.find(n => n.id === id);
    if (note) note.title = newTitle.substring(0, 40);
    saveToLocal();
    renderNotesList();
    if (currentNoteId === id) renderCurrentNote();
}

function updateCurrentNote() {
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;
    note.title = document.getElementById('noteTitle').value;
    note.body = document.getElementById('noteBody').value;
    saveToLocal();
    renderNotesList();
    updateCounters();
}

function updateCurrentTodos(todos) {
    const note = notes.find(n => n.id === currentNoteId);
    if (note) {
        note.todos = todos;
        saveToLocal();
        renderTodoList();
    }
}

// ------------------- RENDER -------------------
function renderNotesList() {
    const container = document.getElementById('noteList');
    const countSpan = document.getElementById('noteCount');
    countSpan.innerText = `${notes.length}`;
    container.innerHTML = '';
    notes.forEach(note => {
        const li = document.createElement('li');
        li.className = (currentNoteId === note.id) ? 'active' : '';

        const titleSpan = document.createElement('span');
        titleSpan.className = 'note-title';
        titleSpan.innerText = note.title || "Untitled";
        titleSpan.contentEditable = true;
        titleSpan.addEventListener('blur', (e) => renameNote(note.id, e.target.innerText));

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        delBtn.className = 'delete-note';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteNote(note.id); };

        li.appendChild(titleSpan);
        li.appendChild(delBtn);
        li.onclick = () => {
            currentNoteId = note.id;
            saveToLocal();
            renderNotesList();
            renderCurrentNote();
        };
        container.appendChild(li);
    });
}

function renderCurrentNote() {
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteBody').value = note.body;
    updateCounters();
    renderTodoList();
}

function renderTodoList() {
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;
    const container = document.getElementById('todoContainer');
    container.innerHTML = '';

    if (note.todos.length === 0) {
        container.innerHTML = '<p class="todo-empty">No tasks yet. Add one below!</p>';
        return;
    }

    note.todos.forEach((todo, idx) => {
        const div = document.createElement('div');
        div.className = 'todo-item' + (todo.done ? ' todo-done' : '');

        // Custom checkbox
        const chkWrapper = document.createElement('label');
        chkWrapper.className = 'todo-check-wrapper';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = todo.done;
        chk.onchange = () => {
            todo.done = chk.checked;
            updateCurrentTodos(note.todos);
        };

        const checkmark = document.createElement('span');
        checkmark.className = 'todo-checkmark';

        chkWrapper.appendChild(chk);
        chkWrapper.appendChild(checkmark);

        // Text
        const textSpan = document.createElement('span');
        textSpan.className = 'todo-text';
        textSpan.contentEditable = true;
        textSpan.innerText = todo.text;
        textSpan.onblur = (e) => {
            todo.text = e.target.innerText.trim();
            updateCurrentTodos(note.todos);
        };

        // Delete
        const del = document.createElement('button');
        del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        del.className = 'todo-delete-btn';
        del.onclick = () => {
            note.todos.splice(idx, 1);
            updateCurrentTodos(note.todos);
        };

        div.appendChild(chkWrapper);
        div.appendChild(textSpan);
        div.appendChild(del);
        container.appendChild(div);
    });
}

// ------------------- REMINDERS -------------------
function setReminder() {
    const dateTime = document.getElementById('reminderDateTime').value;
    const message = document.getElementById('reminderMessage').value.trim();
    if (!dateTime || !message) { alert("Set both date/time and message"); return; }
    const targetTime = new Date(dateTime).getTime();
    if (targetTime <= Date.now()) { alert("Pick a future time"); return; }

    const id = Date.now();
    const timerId = setTimeout(() => triggerReminder(id), targetTime - Date.now());
    reminders.push({ id, dateTime, message, timerId, triggered: false });
    saveReminders();
    renderReminderList();

    document.getElementById('reminderDateTime').value = '';
    document.getElementById('reminderMessage').value = '';
}

function triggerReminder(id) {
    const r = reminders.find(r => r.id === id);
    if (!r) return;
    r.triggered = true;
    saveReminders();
    renderReminderList();

    if (Notification.permission === "granted") {
        new Notification("📝 Notepad Reminder", { body: r.message });
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(perm => {
            if (perm === "granted") new Notification("📝 Notepad Reminder", { body: r.message });
        });
    }
}

function deleteReminder(id) {
    const r = reminders.find(r => r.id === id);
    if (r && r.timerId) clearTimeout(r.timerId);
    reminders = reminders.filter(r => r.id !== id);
    saveReminders();
    renderReminderList();
}

function renderReminderList() {
    const container = document.getElementById('reminderList');
    if (!container) return;
    container.innerHTML = '';

    if (reminders.length === 0) {
        container.innerHTML = '<p class="reminder-empty">No reminders set.</p>';
        return;
    }

    reminders.forEach(r => {
        const div = document.createElement('div');
        div.className = 'reminder-item' + (r.triggered ? ' reminder-triggered' : '');

        const icon = document.createElement('span');
        icon.className = 'reminder-icon';
        icon.innerHTML = r.triggered ? '✅' : '⏰';

        const info = document.createElement('div');
        info.className = 'reminder-info';

        const msg = document.createElement('span');
        msg.className = 'reminder-msg';
        msg.innerText = r.message;

        const time = document.createElement('span');
        time.className = 'reminder-time';
        time.innerText = new Date(r.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

        info.appendChild(msg);
        info.appendChild(time);

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        delBtn.className = 'reminder-delete-btn';
        delBtn.title = 'Delete reminder';
        delBtn.onclick = () => deleteReminder(r.id);

        div.appendChild(icon);
        div.appendChild(info);
        div.appendChild(delBtn);
        container.appendChild(div);
    });
}

// ------------------- COUNTERS / AUTO-SAVE -------------------
function updateCounters() {
    const text = document.getElementById('noteBody').value;
    const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
    document.getElementById('wordCount').innerText = `Words: ${words}`;
    document.getElementById('charCount').innerText = `Chars: ${text.length}`;
}

function triggerAutoSave() {
    const statusSpan = document.getElementById('autoSaveStatus');
    statusSpan.innerHTML = '💾 Saving...';
    updateCurrentNote();
    setTimeout(() => {
        statusSpan.innerHTML = '✅ Saved';
        setTimeout(() => {
            if (document.getElementById('autoSaveStatus').innerHTML === '✅ Saved')
                statusSpan.innerHTML = '✍️ Auto-save on';
        }, 1200);
    }, 50);
}

function formatText(command) {
    document.getElementById('noteBody').focus();
    if (command === 'highlight') document.execCommand('backColor', false, 'yellow');
    else document.execCommand(command, false, null);
    triggerAutoSave();
}

function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Voice typing not supported. Use Chrome/Edge."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.start();
    const statusSpan = document.getElementById('autoSaveStatus');
    statusSpan.innerHTML = '🎤 Listening...';
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const textarea = document.getElementById('noteBody');
        textarea.value += (textarea.value ? ' ' : '') + transcript;
        triggerAutoSave();
        statusSpan.innerHTML = '✅ Voice added';
        setTimeout(() => { if (statusSpan.innerHTML === '✅ Voice added') statusSpan.innerHTML = '✍️ Auto-save on'; }, 2000);
    };
    recognition.onerror = () => { statusSpan.innerHTML = '❌ Voice failed'; };
}

function exportTxt() {
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;
    const content = `${note.title}\n\n${note.body}\n\n--- To-Do List ---\n${note.todos.map(t => `${t.done ? '✓' : '□'} ${t.text}`).join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
    link.click();
}

function saveSettings() {
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    localStorage.setItem('fontSize', document.getElementById('fontSizeSelect').value);
}

function loadSettings() {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
    const savedFontSize = localStorage.getItem('fontSize');
    if (savedFontSize) {
        document.getElementById('fontSizeSelect').value = savedFontSize;
        document.getElementById('noteBody').style.fontSize = savedFontSize;
    }
}

// ------------------- EVENT LISTENERS -------------------
document.getElementById('newNoteBtn').onclick = () => createNewNote();
document.getElementById('boldBtn').onclick = () => formatText('bold');
document.getElementById('italicBtn').onclick = () => formatText('italic');
document.getElementById('underlineBtn').onclick = () => formatText('underline');
document.getElementById('highlightBtn').onclick = () => formatText('highlight');
document.getElementById('exportTxtBtn').onclick = () => exportTxt();
document.getElementById('voiceBtn').onclick = () => startVoice();
document.getElementById('setReminderBtn').onclick = () => setReminder();

document.getElementById('addTodoBtn').onclick = () => {
    const newText = document.getElementById('newTodoText').value.trim();
    if (!newText) return;
    const note = notes.find(n => n.id === currentNoteId);
    if (note) {
        note.todos.push({ text: newText, done: false });
        updateCurrentTodos(note.todos);
        document.getElementById('newTodoText').value = '';
    }
};

document.getElementById('newTodoText').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('addTodoBtn').click();
});

document.getElementById('fontSizeSelect').onchange = (e) => {
    document.getElementById('noteBody').style.fontSize = e.target.value;
    saveSettings();
};

document.getElementById('darkModeToggle').onclick = () => {
    document.body.classList.toggle('dark');
    saveSettings();
};

document.getElementById('passwordBtn').onclick = () => managePassword();

document.getElementById('noteTitle').addEventListener('input', triggerAutoSave);
document.getElementById('noteBody').addEventListener('input', () => { updateCounters(); triggerAutoSave(); });

setInterval(() => { if (currentNoteId) updateCurrentNote(); }, 4000);

if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
}

loadData();