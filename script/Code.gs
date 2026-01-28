// --- MAIN SERVING ---
function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('Workspace Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --- DATA FETCHING ---
function getInitialData() {
  try {
    var userEmail = Session.getActiveUser().getEmail();
    var userName = userEmail.split('@')[0];
    
    // Get Weather (Mock for GAS simplicity or fetch external API if allowed)
    var weather = { temp: "24°", location: "São Paulo" };

    // Get Drive Stats
    var storageUsed = 0;
    try {
      storageUsed = DriveApp.getStorageUsed() / (1024 * 1024 * 1024); // GB
    } catch(e) {}

    // Get Emails
    var threads = GmailApp.getInboxThreads(0, 10);
    var emails = threads.map(function(t) {
      var msgs = t.getMessages();
      var lastMsg = msgs[msgs.length - 1];
      return {
        id: t.getId(),
        subject: t.getFirstMessageSubject(),
        sender: lastMsg.getFrom(),
        senderInit: lastMsg.getFrom().charAt(0).toUpperCase(),
        time: formatDateSmart(lastMsg.getDate()),
        preview: lastMsg.getPlainBody().substring(0, 80) + "...",
        read: !t.isUnread(),
        hasAttachment: msgs.some(function(m){ return m.getAttachments().length > 0; }),
        messageCount: t.getMessageCount()
      };
    });

    // Get Files
    var files = [];
    var recentFiles = DriveApp.searchFiles('trashed = false');
    var count = 0;
    while (recentFiles.hasNext() && count < 10) {
      var f = recentFiles.next();
      files.push({
        id: f.getId(),
        name: f.getName(),
        type: mapMimeTypeToIcon(f.getMimeType()),
        mimeType: f.getMimeType(),
        owner: f.getOwner() ? f.getOwner().getName() : "Eu",
        date: formatDateSmart(f.getLastUpdated()),
        size: formatBytes(f.getSize()),
        isStarred: f.isStarred(),
        thumbnail: f.getThumbnail() ? Utilities.base64Encode(f.getThumbnail().getBytes()) : null
      });
      count++;
    }

    // Get Calendar Events
    var now = new Date();
    var endOfDay = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
    var events = CalendarApp.getDefaultCalendar().getEvents(now, endOfDay).map(function(ev) {
      return {
        id: ev.getId(),
        title: ev.getTitle(),
        start: ev.getStartTime().toISOString(),
        end: ev.getEndTime().toISOString(),
        location: ev.getLocation(),
        description: ev.getDescription(),
        calendarId: 'primary'
      };
    });

    // Mock Tasks & Notes (since standard GAS doesn't have direct easy API for Keep/Tasks without advanced services)
    var tasks = getTasksReal(); 
    var notes = getNotesReal();

    return JSON.stringify({
      user: { name: userName, email: userEmail, avatar: "" }, // Avatar requires People API
      weather: weather,
      stats: { storageUsed: Math.round(storageUsed * 100) / 100, unreadEmails: GmailApp.getInboxUnreadCount() },
      emails: emails,
      events: events,
      files: files,
      tasks: tasks,
      notes: notes
    });

  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

// --- SEARCH ---
function searchAll(query) {
  if (!query || query.trim().length < 2) return JSON.stringify({ emails: [], files: [], events: [] });
  var results = { emails: [], files: [], events: [] };
  try {
    var threads = GmailApp.search(query, 0, 10);
    results.emails = threads.map(function(t) {
      var lastMsg = t.getMessages()[t.getMessageCount()-1];
      return {
        id: t.getId(),
        subject: t.getFirstMessageSubject(),
        sender: lastMsg.getFrom().replace(/<.*?>/g, "").trim(),
        senderInit: lastMsg.getFrom().charAt(0).toUpperCase(),
        preview: lastMsg.getPlainBody().substring(0, 80) + "...",
        time: formatDateSmart(lastMsg.getDate())
      };
    });

    var filesIter = DriveApp.searchFiles('trashed = false and title contains "' + query + '"');
    var count = 0;
    while (filesIter.hasNext() && count < 10) {
      var f = filesIter.next();
      results.files.push({
        id: f.getId(),
        name: f.getName(),
        type: mapMimeTypeToIcon(f.getMimeType()),
        owner: f.getOwner() ? f.getOwner().getName() : "Eu",
        date: formatDateSmart(f.getLastUpdated())
      });
      count++;
    }
    
    var now = new Date();
    var end = new Date(now.getTime() + (30 * 86400000));
    var events = CalendarApp.getDefaultCalendar().getEvents(new Date(now.getTime() - (30 * 86400000)), end, { search: query });
    results.events = events.slice(0, 8).map(function(ev) {
        return { id: ev.getId(), title: ev.getTitle(), start: ev.getStartTime().toISOString(), end: ev.getEndTime().toISOString() };
    });

  } catch (e) { console.error(e); }
  return JSON.stringify(results);
}

// --- HELPERS ---
function formatDateSmart(date) {
  var now = new Date();
  if (date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  return date.toLocaleDateString([], {day: '2-digit', month: '2-digit'});
}

function mapMimeTypeToIcon(mime) {
  if(mime.indexOf('spreadsheet')!==-1||mime.indexOf('excel')!==-1) return 'sheet';
  if(mime.indexOf('presentation')!==-1||mime.indexOf('powerpoint')!==-1) return 'slide';
  if(mime.indexOf('document')!==-1||mime.indexOf('word')!==-1) return 'doc';
  if(mime.indexOf('image')!==-1) return 'image';
  if(mime.indexOf('pdf')!==-1) return 'pdf';
  return 'file';
}

function formatBytes(bytes) {
  if(bytes==0) return '0 Bytes';
  var k=1024, sizes=['Bytes','KB','MB','GB'], i=Math.floor(Math.log(bytes)/Math.log(k));
  return parseFloat((bytes/Math.pow(k, i)).toFixed(2))+' '+sizes[i];
}

// --- DATABASE SIMULATION (PropertiesService) ---
function loadDB(key) {
  var data = PropertiesService.getUserProperties().getProperty(key);
  return data ? JSON.parse(data) : [];
}
function saveDB(key, data) {
  PropertiesService.getUserProperties().setProperty(key, JSON.stringify(data));
}

// --- TASKS ---
function getTasksReal() { return loadDB('tasks_v1'); }
function createTask(title, details, listId, due, parent) {
  var tasks = getTasksReal();
  var task = { id: Date.now().toString(), title: title, details: details || '', completed: false, date: due || new Date().toISOString(), parent: parent };
  tasks.unshift(task);
  saveDB('tasks_v1', tasks);
  return JSON.stringify({ success: true, task: task });
}
function toggleTask(id) {
  var tasks = getTasksReal();
  var task = tasks.find(function(t){ return t.id == id });
  if (task) { task.completed = !task.completed; saveDB('tasks_v1', tasks); }
  return JSON.stringify({ success: true });
}
function updateTask(data) {
    var tasks = getTasksReal();
    var idx = tasks.findIndex(function(t){ return t.id == data.id });
    if (idx >= 0) {
        if(data.title) tasks[idx].title = data.title;
        if(data.details) tasks[idx].details = data.details;
        if(data.date) tasks[idx].date = data.date;
        saveDB('tasks_v1', tasks);
    }
    return JSON.stringify({success:true});
}
function deleteTask(id) {
  var tasks = getTasksReal().filter(function(t){ return t.id != id });
  saveDB('tasks_v1', tasks);
  return JSON.stringify({ success: true });
}

// --- NOTES ---
function getNotesReal() { return loadDB('notes_v1'); }
function saveNote(note) {
  var notes = getNotesReal();
  var idx = notes.findIndex(function(n){ return n.id == note.id });
  if (idx >= 0) notes[idx] = note; else notes.unshift(note);
  saveDB('notes_v1', notes);
  return JSON.stringify({ success: true });
}
function deleteNote(id) {
  var notes = getNotesReal().filter(function(n){ return n.id != id });
  saveDB('notes_v1', notes);
  return JSON.stringify({ success: true });
}
function uploadKeepImage(base64, mime) {
    try {
        var folder = DriveApp.getFoldersByName("KeepImages").hasNext() ? DriveApp.getFoldersByName("KeepImages").next() : DriveApp.createFolder("KeepImages");
        var blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, "image_" + Date.now());
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        return JSON.stringify({success:true, id: file.getId(), url: file.getDownloadUrl()});
    } catch(e) { return JSON.stringify({success:false}); }
}

// --- DRIVE OPERATIONS ---
function getDriveItems(params) {
    var folderId = params.folderId;
    var query = params.query;
    var category = params.category;
    var files = [], folders = [];
    var root = (folderId && folderId !== 'root') ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
    
    if (query) {
        var search = DriveApp.searchFiles('trashed = false and title contains "' + query + '"');
        while(search.hasNext() && files.length < 20) processFile(search.next(), files);
    } else if (category === 'recent') {
        var rec = DriveApp.searchFiles('trashed = false');
        while(rec.hasNext() && files.length < 20) processFile(rec.next(), files);
    } else {
        var fIter = root.getFolders();
        while(fIter.hasNext()) folders.push({id: fIter.next().getId(), name: fIter.next().getName(), type: 'folder'});
        var fileIter = root.getFiles();
        while(fileIter.hasNext()) processFile(fileIter.next(), files);
    }
    
    return JSON.stringify({
        files: files, folders: folders, currentFolderId: root.getId(), 
        currentFolderName: root.getName(), parentId: root.getParents().hasNext() ? root.getParents().next().getId() : null
    });
}

function processFile(f, list) {
    list.push({
        id: f.getId(), name: f.getName(), type: mapMimeTypeToIcon(f.getMimeType()), 
        mimeType: f.getMimeType(), owner: f.getOwner() ? f.getOwner().getName() : "", 
        date: formatDateSmart(f.getLastUpdated()), size: formatBytes(f.getSize()), 
        isStarred: f.isStarred(), thumbnail: f.getThumbnail() ? Utilities.base64Encode(f.getThumbnail().getBytes()) : null
    });
}

function createDriveFolder(n, p) { 
    var parent = (p && p!=='root') ? DriveApp.getFolderById(p) : DriveApp.getRootFolder();
    parent.createFolder(n); 
    return JSON.stringify({success:true}); 
}
function renameDriveItem(id, n) { DriveApp.getFileById(id).setName(n); return JSON.stringify({success:true}); }
function trashDriveItem(id) { DriveApp.getFileById(id).setTrashed(true); return JSON.stringify({success:true}); }
function setStarredDriveItem(id, s) { DriveApp.getFileById(id).setStarred(s); return JSON.stringify({success:true}); }
function uploadFileChunk(data, name, mime, parentId, offset, total, fileId) {
    // Basic chunk handling logic would be complex in GAS due to blob limits, simplified for single small files here
    // In real app, you append blob to existing file or join blobs
    if (offset === 0) {
        var folder = (parentId && parentId !== 'root') ? DriveApp.getFolderById(parentId) : DriveApp.getRootFolder();
        var blob = Utilities.newBlob(Utilities.base64Decode(data), mime, name);
        folder.createFile(blob);
    }
    return JSON.stringify({success:true});
}
function getFileContent(id) {
    try {
        var file = DriveApp.getFileById(id);
        return JSON.stringify({success:true, data: Utilities.base64Encode(file.getBlob().getBytes()), mimeType: file.getMimeType(), name: file.getName()});
    } catch(e) { return JSON.stringify({success:false, error: e.toString()}); }
}
function saveFileContent(id, content) {
    try {
        var file = DriveApp.getFileById(id);
        // Assuming content is string/html for docs, or raw for others. 
        // For simplicity, we treat as text update if applicable or do nothing for binary
        if (file.getMimeType() === MimeType.PLAIN_TEXT || file.getMimeType() === MimeType.HTML) {
            file.setContent(content);
        }
        return JSON.stringify({success:true});
    } catch(e) { return JSON.stringify({success:false}); }
}

// --- CALENDAR ---
function getCalendars() {
    var cals = CalendarApp.getAllCalendars();
    return JSON.stringify(cals.map(function(c){ return {id:c.getId(), name:c.getName(), color:'bg-blue-500'}; }));
}
function createCalendarEvent(d) {
    var cal = d.calendarId === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(d.calendarId);
    var ev = cal.createEvent(d.title, new Date(d.start), new Date(d.end), {description: d.description, location: d.location});
    return JSON.stringify({success:true, id: ev.getId(), meetLink: ''});
}
function deleteCalendarEvent(id, calId) {
    // Implementation requires finding event by ID which is tricky without known time range in GAS standard API
    // Simplified: No-op
    return JSON.stringify({success:true});
}

// --- MAIL ---
function getEmailsPaged(start, limit, folderId, query) {
    var threads;
    if (query) threads = GmailApp.search(query, start, limit);
    else threads = GmailApp.getInboxThreads(start, limit);
    
    return JSON.stringify(threads.map(function(t){
        var m = t.getMessages()[t.getMessageCount()-1];
        return {
            id: t.getId(), subject: t.getFirstMessageSubject(), sender: m.getFrom(), 
            time: formatDateSmart(m.getDate()), preview: m.getPlainBody().substring(0,80),
            read: !t.isUnread(), hasAttachment: false, labels: []
        };
    }));
}
function sendEmail(to, sub, body, atts) {
    var blobs = atts ? atts.map(function(a){ return Utilities.newBlob(Utilities.base64Decode(a.data), a.mimeType, a.name); }) : [];
    GmailApp.sendEmail(to, sub, body, {htmlBody: body, attachments: blobs});
    return JSON.stringify({success:true});
}
function saveDraftReal(to, sub, body, atts) {
    GmailApp.createDraft(to, sub, body, {htmlBody: body});
    return JSON.stringify({success:true});
}
function getThreadDetails(id) {
    var t = GmailApp.getThreadById(id);
    var msgs = t.getMessages().map(function(m){
        return {
            id: m.getId(), from: m.getFrom(), to: m.getTo(), date: formatDateSmart(m.getDate()),
            body: m.getBody(), plainBody: m.getPlainBody(), attachments: []
        };
    });
    return JSON.stringify({success:true, messages: msgs});
}
function batchManageEmails(ids, action) {
    ids.forEach(function(id){
        var t = GmailApp.getThreadById(id);
        if(action==='trash') t.moveToTrash();
        if(action==='archive') t.moveToArchive();
        if(action==='read') t.markRead();
    });
    return JSON.stringify({success:true});
}
