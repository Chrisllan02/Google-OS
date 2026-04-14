// ============================================================
// GOOGLE OS — WORKSPACE DASHBOARD — APPS SCRIPT BACKEND
// ============================================================
// Cole este arquivo num Google Apps Script vinculado à sua conta.
//
// Serviços Avançados necessários (Recursos > Serviços avançados do Google):
//   ✅ Tasks API (v1)
//
// Após publicar como Web App:
//   • Execute como: Usuário que está acessando o app
//   • Quem tem acesso: Qualquer pessoa com conta do Google (ou Sua organização)
// ============================================================

// ─── HELPERS ─────────────────────────────────────────────────

function mimeToType_(mime) {
  if (!mime) return 'file';
  if (mime.includes('document'))     return 'doc';
  if (mime.includes('spreadsheet'))  return 'sheet';
  if (mime.includes('presentation')) return 'slide';
  if (mime.includes('image'))        return 'image';
  if (mime.includes('pdf'))          return 'pdf';
  if (mime.includes('folder'))       return 'folder';
  if (mime.includes('video'))        return 'video';
  return 'file';
}

function relTime_(date) {
  if (!date) return '';
  const now  = new Date();
  const diff = now - date;
  const min  = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (min  <  1)  return 'Agora';
  if (min  < 60)  return min + ' min';
  if (hrs  <  6)  return hrs + 'h atrás';
  if (days === 0) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Ontem';
  if (days <  7)  return date.toLocaleDateString('pt-BR', { weekday: 'short' });
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function safe_(fn, fallback) {
  try { return fn(); } catch(e) { return fallback; }
}

// ─── WEB APP ENTRY POINT ─────────────────────────────────────

function doGet(e) {
  return HtmlService
    .createTemplateFromFile('index')
    .evaluate()
    .setTitle('Google OS — Workspace')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ─── INITIAL DATA ────────────────────────────────────────────

function getInitialData() {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const userName  = userEmail.split('@')[0]
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, function(l) { return l.toUpperCase(); });

    // Emails
    const threads     = safe_(function() { return GmailApp.getInboxThreads(0, 8); }, []);
    const unreadCount = safe_(function() { return GmailApp.getInboxUnreadCount(); }, 0);
    const emails = threads.map(function(thread) {
      return safe_(function() {
        var msg   = thread.getMessages()[0];
        var from  = msg.getFrom();
        var name  = from.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || from;
        var email = (from.match(/<([^>]+)>/) || [null, from])[1];
        return {
          id: thread.getId(), threadId: thread.getId(),
          sender: name, senderInit: name[0].toUpperCase(), senderEmail: email,
          subject: thread.getFirstMessageSubject() || '(sem assunto)',
          preview: msg.getPlainBody().replace(/\s+/g, ' ').substring(0, 200),
          time: relTime_(msg.getDate()),
          isRead: !thread.isUnread(), isStarred: thread.isImportant(),
          color: 'bg-blue-600',
          labels: safe_(function() { return thread.getLabels().map(function(l) { return l.getName(); }); }, []),
        };
      }, null);
    }).filter(Boolean);

    // Calendar
    var defaultCal = safe_(function() { return CalendarApp.getDefaultCalendar(); }, null);
    var calEvents  = [];
    if (defaultCal) {
      var wkStart = new Date(); wkStart.setDate(wkStart.getDate() - wkStart.getDay()); wkStart.setHours(0,0,0,0);
      var wkEnd   = new Date(wkStart); wkEnd.setDate(wkStart.getDate() + 6); wkEnd.setHours(23,59,59,999);
      calEvents = safe_(function() {
        return defaultCal.getEvents(wkStart, wkEnd).slice(0,15).map(function(ev) {
          return {
            id: ev.getId(), title: ev.getTitle(),
            start: ev.getStartTime().toISOString(), end: ev.getEndTime().toISOString(),
            calendarId: 'primary', isAllDay: ev.isAllDayEvent(),
            description: ev.getDescription() || '', location: ev.getLocation() || '',
            color: '#4285F4',
            meetLink: safe_(function() { return ev.getTag('hangoutLink') || ''; }, ''),
          };
        });
      }, []);
    }

    // Drive
    var driveFiles = [];
    safe_(function() {
      var iter  = DriveApp.searchFiles('mimeType != "application/vnd.google-apps.folder" and trashed = false');
      var count = 0;
      while (iter.hasNext() && count < 6) {
        var f = iter.next();
        driveFiles.push({
          id: f.getId(), name: f.getName(), type: mimeToType_(f.getMimeType()),
          mimeType: f.getMimeType(),
          owner: safe_(function() { return f.getOwner().getName(); }, userEmail),
          date: 'Editado ' + relTime_(f.getLastUpdated()),
          isStarred: f.isStarred(), webViewLink: f.getUrl(),
        });
        count++;
      }
    }, null);

    // Tasks
    var tasksArr = [];
    safe_(function() {
      var lists = Tasks.Tasklists.list({ maxResults: 1 });
      if (lists.items && lists.items.length > 0) {
        var listId = lists.items[0].id;
        var tasks  = Tasks.Tasks.list(listId, { maxResults: 10, showCompleted: true });
        if (tasks.items) {
          tasksArr = tasks.items.map(function(t) {
            return { id: t.id, title: t.title, details: t.notes || '',
              completed: t.status === 'completed', date: t.due || null, listId: listId };
          });
        }
      }
    }, null);

    // Calendars list
    var calendars = safe_(function() {
      return CalendarApp.getAllCalendars().map(function(c) {
        return { id: c.getId(), name: c.getName(), color: c.getColor(),
          checked: c.isSelected(), accessRole: c.isOwnedByMe() ? 'owner' : 'reader' };
      });
    }, [{ id: 'primary', name: 'Meu calendário', color: '#4285F4', checked: true, accessRole: 'owner' }]);

    return JSON.stringify({
      user: { name: userName, email: userEmail,
        avatar: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName) + '&background=4285F4&color=fff&size=128' },
      weather: { temp: '--°', location: '' },
      stats: { storageUsed: 50, unreadEmails: unreadCount },
      emails: emails, events: calEvents, files: driveFiles,
      tasks: tasksArr, notes: [], calendars: calendars,
    });
  } catch(e) {
    return JSON.stringify({ error: 'getInitialData: ' + e.message });
  }
}

// ─── CALENDAR ────────────────────────────────────────────────

function getCalendars() {
  try {
    var cals = CalendarApp.getAllCalendars();
    return JSON.stringify(cals.map(function(c) {
      return { id: c.getId(), name: c.getName(), color: c.getColor(),
        checked: c.isSelected(), accessRole: c.isOwnedByMe() ? 'owner' : 'reader' };
    }));
  } catch(e) { return JSON.stringify([]); }
}

function getEvents(calendarId, start, end) {
  try {
    var cal = (calendarId === 'primary' || !calendarId)
      ? CalendarApp.getDefaultCalendar()
      : CalendarApp.getCalendarById(calendarId);
    if (!cal) return JSON.stringify([]);
    return JSON.stringify(cal.getEvents(new Date(start), new Date(end)).map(function(ev) {
      return {
        id: ev.getId(), title: ev.getTitle(),
        start: ev.getStartTime().toISOString(), end: ev.getEndTime().toISOString(),
        calendarId: calendarId || 'primary', isAllDay: ev.isAllDayEvent(),
        description: ev.getDescription() || '', location: ev.getLocation() || '',
        color: '#4285F4',
        meetLink: safe_(function() { return ev.getTag('hangoutLink') || ''; }, ''),
      };
    }));
  } catch(e) { return JSON.stringify([]); }
}

function createCalendarEvent(data) {
  try {
    var cal = (data.calendarId && data.calendarId !== 'primary')
      ? CalendarApp.getCalendarById(data.calendarId)
      : CalendarApp.getDefaultCalendar();
    var ev = data.isAllDay
      ? cal.createAllDayEvent(data.title, new Date(data.start))
      : cal.createEvent(data.title, new Date(data.start), new Date(data.end));
    if (data.description) ev.setDescription(data.description);
    if (data.location)    ev.setLocation(data.location);
    if (data.guests) data.guests.forEach(function(g) {
      safe_(function() { ev.addGuest(g.email); }, null);
    });
    return JSON.stringify({ success: true, id: ev.getId() });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function updateCalendarEvent(data) {
  try {
    var cal = (data.calendarId && data.calendarId !== 'primary')
      ? CalendarApp.getCalendarById(data.calendarId)
      : CalendarApp.getDefaultCalendar();
    var ev = cal.getEventById(data.id);
    if (!ev) return JSON.stringify({ success: false, error: 'Evento não encontrado' });
    if (data.title)       ev.setTitle(data.title);
    if (data.description) ev.setDescription(data.description);
    if (data.location)    ev.setLocation(data.location);
    if (data.start && data.end) ev.setTime(new Date(data.start), new Date(data.end));
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function deleteCalendarEvent(id, calendarId) {
  try {
    var cal = (calendarId && calendarId !== 'primary')
      ? CalendarApp.getCalendarById(calendarId)
      : CalendarApp.getDefaultCalendar();
    var ev = cal.getEventById(id);
    if (ev) ev.deleteEvent();
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false }); }
}

function rsvpEvent(eventId, status) {
  // CalendarApp não expõe RSVP — use Calendar Advanced Service se necessário
  return JSON.stringify({ success: true });
}

function checkFreeBusy(start, end, emails) {
  return JSON.stringify({ success: true, freeBusy: {} });
}

// ─── GMAIL ───────────────────────────────────────────────────

function sendEmail(to, subject, body, attachments) {
  try {
    var opts = { htmlBody: body, name: Session.getActiveUser().getEmail() };
    if (attachments && attachments.length > 0) {
      opts.attachments = attachments.map(function(a) {
        return Utilities.newBlob(Utilities.base64Decode(a.data), a.mimeType, a.name);
      });
    }
    GmailApp.sendEmail(to, subject, body, opts);
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function saveDraft(to, subject, body, attachments) {
  try {
    GmailApp.createDraft(to, subject, body, { htmlBody: body });
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function scheduleSend(to, subject, body, time, attachments) {
  // GAS não suporta agendamento nativo — salva como rascunho
  return saveDraft(to, subject, '[Agendado para ' + time + '] ' + body, attachments);
}

function getThreadDetails(threadId) {
  try {
    var thread = GmailApp.getThreadById(threadId);
    if (!thread) return JSON.stringify({ success: false });
    var messages = thread.getMessages().map(function(msg) {
      return {
        id: msg.getId(), from: msg.getFrom(), to: msg.getTo(),
        subject: msg.getSubject(), body: msg.getBody(),
        date: msg.getDate().toISOString(), isRead: !msg.isUnread(),
      };
    });
    return JSON.stringify({ success: true, messages: messages });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function batchManageEmails(ids, action) {
  try {
    ids.forEach(function(id) {
      safe_(function() {
        var thread = GmailApp.getThreadById(id.toString());
        if (!thread) return;
        if (action === 'read')    thread.markRead();
        if (action === 'unread')  thread.markUnread();
        if (action === 'archive') thread.moveToArchive();
        if (action === 'trash')   thread.moveToTrash();
        if (action === 'spam')    thread.moveToSpam();
        if (action === 'star')    thread.getMessages().forEach(function(m) { m.star(); });
        if (action === 'unstar')  thread.getMessages().forEach(function(m) { m.unstar(); });
      }, null);
    });
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false }); }
}

function createLabel(name) {
  try {
    GmailApp.createLabel(name);
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false }); }
}

function snoozeEmail(id, until) {
  // Salva em Properties para reprocessamento futuro
  try {
    PropertiesService.getScriptProperties()
      .setProperty('snooze_' + id, JSON.stringify({ until: until }));
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false }); }
}

function searchAll(query) {
  try {
    var q = query || '';
    var emails = safe_(function() {
      return GmailApp.search(q, 0, 5).map(function(t) {
        var msg = t.getMessages()[0];
        return {
          id: t.getId(), subject: t.getFirstMessageSubject(),
          sender: msg.getFrom().replace(/<[^>]+>/, '').trim(),
          preview: msg.getPlainBody().substring(0, 100),
          time: relTime_(msg.getDate()),
        };
      });
    }, []);

    var files = [];
    safe_(function() {
      var iter  = DriveApp.searchFiles('title contains "' + q.replace(/"/g,'') + '" and trashed=false');
      var count = 0;
      while (iter.hasNext() && count < 5) {
        var f = iter.next();
        files.push({ id: f.getId(), name: f.getName(), type: mimeToType_(f.getMimeType()),
          date: relTime_(f.getLastUpdated()) });
        count++;
      }
    }, null);

    var events = safe_(function() {
      var now = new Date();
      var end = new Date(); end.setMonth(end.getMonth() + 3);
      return CalendarApp.getDefaultCalendar().getEvents(now, end)
        .filter(function(ev) { return ev.getTitle().toLowerCase().indexOf(q.toLowerCase()) >= 0; })
        .slice(0,5).map(function(ev) {
          return { id: ev.getId(), title: ev.getTitle(),
            start: ev.getStartTime().toISOString(), end: ev.getEndTime().toISOString(), calendarId: 'primary' };
        });
    }, []);

    return JSON.stringify({ emails: emails, files: files, events: events });
  } catch(e) { return JSON.stringify({ emails: [], files: [], events: [] }); }
}

function searchContacts(query) {
  try {
    var contacts = ContactsApp.getContactsByName(query);
    return JSON.stringify(contacts.slice(0,5).map(function(c) {
      var emails = c.getEmails();
      return {
        name: c.getFullName(),
        email: emails.length > 0 ? emails[0].getAddress() : '',
        avatar: c.getFullName()[0].toUpperCase(),
      };
    }));
  } catch(e) { return JSON.stringify([]); }
}

// ─── DRIVE ───────────────────────────────────────────────────

function getDriveItems(params) {
  try {
    var folderId = params.folderId;
    var category = params.category;
    var query    = params.query;
    var files    = [], folders = [], parentId = null;
    var currentFolderName = 'Meu Drive';

    if (category === 'starred') {
      var iter = DriveApp.searchFiles('starred = true and trashed = false');
      while (iter.hasNext()) {
        var f = iter.next();
        files.push(driveFileObj_(f));
      }
    } else if (category === 'trash') {
      var iter = DriveApp.searchFiles('trashed = true');
      while (iter.hasNext()) files.push(driveFileObj_(iter.next()));
    } else if (category === 'shared') {
      var iter = DriveApp.searchFiles('sharedWithMe = true and trashed = false');
      while (iter.hasNext()) files.push(driveFileObj_(iter.next()));
    } else if (query) {
      var iter = DriveApp.searchFiles('title contains "' + query.replace(/"/g,'') + '" and trashed = false');
      while (iter.hasNext()) files.push(driveFileObj_(iter.next()));
      var fIter = DriveApp.searchFolders('title contains "' + query.replace(/"/g,'') + '" and trashed = false');
      while (fIter.hasNext()) {
        var folder = fIter.next();
        folders.push({ id: folder.getId(), name: folder.getName(), type: 'folder',
          owner: safe_(function() { return folder.getOwner().getName(); }, ''),
          date: relTime_(folder.getLastUpdated()), isStarred: folder.isStarred() });
      }
    } else {
      var root = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
      currentFolderName = root.getName();
      var parents = root.getParents();
      if (parents.hasNext()) parentId = parents.next().getId();
      var fIter = root.getFolders();
      while (fIter.hasNext()) {
        var folder = fIter.next();
        folders.push({ id: folder.getId(), name: folder.getName(), type: 'folder',
          owner: safe_(function() { return folder.getOwner().getName(); }, ''),
          date: relTime_(folder.getLastUpdated()), isStarred: folder.isStarred() });
      }
      var fileIter = root.getFiles();
      while (fileIter.hasNext()) files.push(driveFileObj_(fileIter.next()));
    }

    return JSON.stringify({
      files: files, folders: folders, category: category || 'root',
      currentFolderName: currentFolderName,
      currentFolderId: folderId || null, parentId: parentId,
    });
  } catch(e) {
    return JSON.stringify({ files:[], folders:[], category:'root',
      currentFolderName:'Meu Drive', currentFolderId:null, parentId:null });
  }
}

function driveFileObj_(f) {
  return {
    id: f.getId(), name: f.getName(), type: mimeToType_(f.getMimeType()),
    mimeType: f.getMimeType(),
    owner: safe_(function() { return f.getOwner().getName(); }, ''),
    date: 'Editado ' + relTime_(f.getLastUpdated()),
    isStarred: f.isStarred(), webViewLink: f.getUrl(), trashed: f.isTrashed(),
  };
}

function createDriveFolder(name, parentId) {
  try {
    var parent = parentId ? DriveApp.getFolderById(parentId) : DriveApp.getRootFolder();
    var folder = parent.createFolder(name);
    return JSON.stringify({ success: true, id: folder.getId() });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function renameDriveItem(id, name) {
  try {
    safe_(function() { DriveApp.getFileById(id).setName(name); },
    function() { DriveApp.getFolderById(id).setName(name); });
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false }); }
}

function trashDriveItem(id) {
  try {
    try { DriveApp.getFileById(id).setTrashed(true); }
    catch(e) { DriveApp.getFolderById(id).setTrashed(true); }
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false }); }
}

function setStarredDriveItem(id, starred) {
  try {
    try { DriveApp.getFileById(id).setStarred(starred); }
    catch(e) { DriveApp.getFolderById(id).setStarred(starred); }
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false }); }
}

function uploadFileToDrive(data, name, mimeType, parentId) {
  try {
    var decoded = Utilities.base64Decode(data);
    var blob    = Utilities.newBlob(decoded, mimeType, name);
    var folder  = parentId ? DriveApp.getFolderById(parentId) : DriveApp.getRootFolder();
    var file    = folder.createFile(blob);
    return JSON.stringify({ success: true, id: file.getId(), url: file.getUrl() });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function getFileContent(id) {
  try {
    var file = DriveApp.getFileById(id);
    var mime = file.getMimeType();

    if (mime === 'application/vnd.google-apps.document') {
      var body = DocumentApp.openById(id).getBody().getText();
      var b64  = Utilities.base64Encode(Utilities.newBlob(body, 'text/plain').getBytes());
      return JSON.stringify({ success: true, data: b64, mimeType: 'text/plain', name: file.getName() });
    }
    if (mime === 'application/vnd.google-apps.spreadsheet') {
      var ss     = SpreadsheetApp.openById(id);
      var sheet  = ss.getActiveSheet();
      var values = sheet.getDataRange().getValues();
      var cells  = {};
      values.forEach(function(row, r) {
        row.forEach(function(val, c) {
          if (val !== '') cells[String.fromCharCode(65 + c) + (r + 1)] = val.toString();
        });
      });
      var b64 = Utilities.base64Encode(Utilities.newBlob(JSON.stringify(cells)).getBytes());
      return JSON.stringify({ success: true, data: b64, mimeType: 'application/json', name: file.getName() });
    }
    var b64 = Utilities.base64Encode(file.getBlob().getBytes());
    return JSON.stringify({ success: true, data: b64, mimeType: mime, name: file.getName() });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function saveFileContent(id, content) {
  try {
    var file  = DriveApp.getFileById(id);
    var mime  = file.getMimeType();
    var bytes = Utilities.base64Decode(content);
    var text  = Utilities.newBlob(bytes).getDataAsString();

    if (mime === 'application/vnd.google-apps.document') {
      var doc = DocumentApp.openById(id);
      doc.getBody().setText(text);
      doc.saveAndClose();
    } else if (mime === 'application/vnd.google-apps.spreadsheet') {
      var ss    = SpreadsheetApp.openById(id);
      var sheet = ss.getActiveSheet();
      var cells = JSON.parse(text);
      Object.keys(cells).forEach(function(key) {
        safe_(function() { sheet.getRange(key).setValue(cells[key]); }, null);
      });
    }
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function moveDriveItem(itemId, targetFolderId) {
  try {
    var target = DriveApp.getFolderById(targetFolderId);
    try {
      var file = DriveApp.getFileById(itemId);
      var parents = file.getParents();
      while (parents.hasNext()) file.removeFromFolder(parents.next());
      file.addToFolder(target);
    } catch(e) {
      var folder  = DriveApp.getFolderById(itemId);
      var parents = folder.getParents();
      while (parents.hasNext()) folder.removeFromFolder(parents.next());
      folder.addToFolder(target);
    }
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false }); }
}

function getDriveShareLink(fileId) {
  try {
    var file = DriveApp.getFileById(fileId);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return JSON.stringify({ url: file.getUrl() });
  } catch(e) { return JSON.stringify({ url: '' }); }
}

function addDrivePermission(fileId, email, role) {
  try {
    var file = DriveApp.getFileById(fileId);
    if (role === 'editor') file.addEditor(email); else file.addViewer(email);
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false }); }
}

function removeDrivePermission(fileId, email) {
  try {
    var file = DriveApp.getFileById(fileId);
    safe_(function() { file.removeEditor(email); }, null);
    safe_(function() { file.removeViewer(email); }, null);
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false }); }
}

// ─── TASKS ───────────────────────────────────────────────────

function getTaskLists() {
  try {
    var lists = Tasks.Tasklists.list({ maxResults: 20 });
    if (!lists.items) return JSON.stringify([{ id: '@default', title: 'Minhas Tarefas' }]);
    return JSON.stringify(lists.items.map(function(l) { return { id: l.id, title: l.title }; }));
  } catch(e) { return JSON.stringify([{ id: '@default', title: 'Minhas Tarefas' }]); }
}

function getTasks(listId) {
  try {
    var tasks = Tasks.Tasks.list(listId || '@default', { maxResults: 100, showCompleted: true, showHidden: false });
    if (!tasks.items) return JSON.stringify([]);
    return JSON.stringify(tasks.items.map(function(t) {
      return { id: t.id, title: t.title, details: t.notes || '',
        completed: t.status === 'completed', date: t.due || null, listId: listId || '@default' };
    }));
  } catch(e) { return JSON.stringify([]); }
}

function createTask(title, details, listId, due, parent) {
  try {
    var body = { title: title, notes: details || '', status: 'needsAction' };
    if (due) body.due = new Date(due).toISOString();
    var opts = {};
    if (parent) opts.parent = parent;
    var created = Tasks.Tasks.insert(body, listId || '@default', opts);
    return JSON.stringify({ success: true, task: { id: created.id, title: created.title, completed: false } });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function toggleTask(id, listId) {
  try {
    var task = Tasks.Tasks.get(listId || '@default', id);
    task.status = (task.status === 'completed') ? 'needsAction' : 'completed';
    if (task.status === 'needsAction') delete task.completed;
    Tasks.Tasks.update(task, listId || '@default', id);
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false }); }
}

function updateTask(task) {
  try {
    var existing = Tasks.Tasks.get(task.listId || '@default', task.id);
    if (task.title   !== undefined) existing.title  = task.title;
    if (task.details !== undefined) existing.notes  = task.details;
    if (task.date    !== undefined) existing.due    = task.date ? new Date(task.date).toISOString() : null;
    if (task.completed !== undefined) {
      existing.status = task.completed ? 'completed' : 'needsAction';
      if (!task.completed) delete existing.completed;
    }
    Tasks.Tasks.update(existing, task.listId || '@default', task.id);
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false }); }
}

function deleteTask(id, listId) {
  try {
    Tasks.Tasks.remove(listId || '@default', id);
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false }); }
}

function createTaskList(title) {
  try {
    var list = Tasks.Tasklists.insert({ title: title });
    return JSON.stringify({ id: list.id, title: list.title });
  } catch(e) { return JSON.stringify(null); }
}

function deleteTaskList(id) {
  try {
    Tasks.Tasklists.remove(id);
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false }); }
}

// ─── MEET SIGNALING (via Script Properties) ──────────────────

function registerMeeting(roomCode, peerId) {
  try {
    PropertiesService.getScriptProperties()
      .setProperty('meet_' + roomCode, JSON.stringify({ peerId: peerId, ts: Date.now() }));
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false }); }
}

function getMeetingPeer(roomCode) {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty('meet_' + roomCode);
    if (!raw) return JSON.stringify(null);
    var data = JSON.parse(raw);
    if (Date.now() - data.ts > 3600000) {
      PropertiesService.getScriptProperties().deleteProperty('meet_' + roomCode);
      return JSON.stringify(null);
    }
    return JSON.stringify(data.peerId);
  } catch(e) { return JSON.stringify(null); }
}
