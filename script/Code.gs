
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Workspace OS')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getInitialData() {
  try {
    var userEmail = Session.getActiveUser().getEmail();
    var user = {
      email: userEmail,
      name: userEmail.split('@')[0], 
      avatar: "https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/4252rscbv5M/photo.jpg" 
    };
    
    var emails = getEmailsReal();
    var labels = getGmailLabelsReal();
    var events = getEventsReal();
    var tasks = getTasksReal();
    var notes = getNotesReal();
    
    var driveData = JSON.parse(getDriveItems({ folderId: 'root' }));
    var files = driveData.files; 
    
    var storageUsed = 0; 
    try { storageUsed = DriveApp.getStorageUsed(); } catch(e) {}
    
    var response = {
      user: user,
      emails: emails,
      labels: labels,
      events: events,
      tasks: tasks,
      notes: notes,
      files: files, 
      weather: { temp: "24°", location: "Corporativo" },
      stats: { storageUsed: storageUsed, unreadEmails: GmailApp.getInboxUnreadCount() }
    };

    return JSON.stringify(response);
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

// --- DATABASE SYSTEM (JSON in Drive) ---
var DB_FOLDER_NAME = ".workspace_os_data";

function getDbFolder() {
  var folders = DriveApp.getFoldersByName(DB_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DB_FOLDER_NAME);
}

function loadDB(filename) {
  try {
    var folder = getDbFolder();
    var files = folder.getFilesByName(filename);
    if (files.hasNext()) {
      var content = files.next().getBlob().getDataAsString();
      return JSON.parse(content);
    }
    return [];
  } catch (e) { return []; }
}

function saveDB(filename, data) {
  try {
    var folder = getDbFolder();
    var files = folder.getFilesByName(filename);
    if (files.hasNext()) {
      files.next().setContent(JSON.stringify(data));
    } else {
      folder.createFile(filename, JSON.stringify(data), MimeType.PLAIN_TEXT);
    }
    return true;
  } catch (e) { return false; }
}

// --- TASKS OPERATIONS ---
function getTasksReal() { return loadDB('tasks.json'); }
function createTask(title) { var tasks = getTasksReal(); var newTask = { id: new Date().getTime(), title: title, completed: false, date: new Date().toISOString() }; tasks.unshift(newTask); saveDB('tasks.json', tasks); return JSON.stringify({ success: true, task: newTask }); }
function toggleTask(id) { var tasks = getTasksReal(); var updated = false; tasks = tasks.map(function(t) { if (t.id == id) { t.completed = !t.completed; updated = true; } return t; }); if(updated) saveDB('tasks.json', tasks); return JSON.stringify({ success: updated }); }
function deleteTask(id) { var tasks = getTasksReal(); var initialLen = tasks.length; tasks = tasks.filter(function(t) { return t.id != id; }); if (tasks.length !== initialLen) saveDB('tasks.json', tasks); return JSON.stringify({ success: true }); }

// --- KEEP NOTES OPERATIONS ---
function getNotesReal() { return loadDB('notes.json'); }
function saveNote(note) { var notes = getNotesReal(); var existingIndex = notes.findIndex(function(n){ return n.id == note.id; }); if (existingIndex >= 0) { notes[existingIndex] = note; } else { notes.unshift(note); } saveDB('notes.json', notes); return JSON.stringify({ success: true }); }
function deleteNote(id) { var notes = getNotesReal(); var initialLen = notes.length; notes = notes.filter(function(n) { return n.id != id; }); if (notes.length !== initialLen) saveDB('notes.json', notes); return JSON.stringify({ success: true }); }

// --- MAIL SERVICES ---
function getEmailsReal() {
  try {
    var threads = GmailApp.getInboxThreads(0, 20);
    return threads.map(function(t) {
      var m = t.getMessages()[0]; 
      return {
        id: t.getId(),
        subject: t.getFirstMessageSubject(),
        sender: m.getFrom().replace(/<.*?>/g, "").trim(),
        senderInit: m.getFrom().charAt(0).toUpperCase(),
        time: formatDateSmart(m.getDate()),
        preview: m.getPlainBody().substring(0, 90) + "...",
        read: !t.isUnread(),
        hasAttachment: t.getMessages().some(function(msg){ return msg.getAttachments().length > 0 }),
        labels: t.getLabels().map(function(l) { return l.getName(); }),
        isStarred: t.hasStarredMessages(),
        folder: 'inbox',
        messageCount: t.getMessageCount()
      };
    });
  } catch (e) { return []; }
}

function getThreadDetails(threadId) {
  try {
    var thread = GmailApp.getThreadById(threadId);
    var messages = thread.getMessages();
    var details = messages.map(function(m) {
      return {
        id: m.getId(),
        from: m.getFrom().replace(/<.*?>/g, "").trim(),
        senderInit: m.getFrom().charAt(0).toUpperCase(),
        to: m.getTo(),
        date: formatDateSmart(m.getDate()),
        body: m.getBody(), 
        plainBody: m.getPlainBody(),
        attachments: m.getAttachments().map(function(att) {
           return { name: att.getName(), mimeType: att.getContentType(), size: formatBytes(att.getSize()) };
        })
      };
    });
    // Mark as read when opened
    if (thread.isUnread()) thread.markRead();
    
    return JSON.stringify({ success: true, messages: details, subject: thread.getFirstMessageSubject() });
  } catch(e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

function getGmailLabelsReal() {
  try {
    var labels = GmailApp.getUserLabels();
    return labels.map(function(l) {
      return { id: l.getName(), name: l.getName(), type: 'user' };
    });
  } catch (e) { return []; }
}

function sendEmail(to, subject, bodyHTML, attachmentsData) {
  try {
    var options = { htmlBody: bodyHTML };
    if (attachmentsData && attachmentsData.length > 0) {
      var blobs = attachmentsData.map(function(att) {
        // att.data é base64
        return Utilities.newBlob(Utilities.base64Decode(att.data), att.mimeType, att.name);
      });
      options.attachments = blobs;
    }
    GmailApp.sendEmail(to, subject, bodyHTML.replace(/<[^>]+>/g, ''), options);
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function manageEmail(id, action) {
  try {
    var thread = GmailApp.getThreadById(id);
    if (!thread) return JSON.stringify({ success: false });
    if (action === 'read') thread.markRead();
    else if (action === 'unread') thread.markUnread();
    else if (action === 'archive') thread.moveToArchive();
    else if (action === 'trash') thread.moveToTrash();
    else if (action === 'spam') thread.moveToSpam();
    else if (action === 'star') { 
        var msgs = thread.getMessages(); 
        if(msgs.length > 0) { if(msgs[0].isStarred()) GmailApp.unstarMessage(msgs[0]); else msgs[0].star(); }
    }
    return JSON.stringify({ success: true });
  } catch (e) { return JSON.stringify({ success: false }); }
}

// --- CALENDAR SERVICES ---
function getEventsReal() {
  try {
    var now = new Date();
    var start = new Date(now.getTime() - (60 * 86400000));
    var end = new Date(now.getTime() + (60 * 86400000));
    var events = CalendarApp.getDefaultCalendar().getEvents(start, end);
    return events.map(function(e) {
      return {
        id: e.getId(),
        title: e.getTitle(),
        start: e.getStartTime().toISOString(),
        end: e.getEndTime().toISOString(),
        location: e.getLocation(),
        isAllDay: e.isAllDayEvent(),
        color: 'bg-blue-500', 
        description: e.getDescription(),
        guests: e.getGuestList().map(function(g){ return {name: g.getEmail(), email: g.getEmail(), avatar: g.getEmail().charAt(0).toUpperCase()}; }),
        recurrence: e.isRecurring() ? 'daily' : 'none' 
      };
    });
  } catch (e) { return []; }
}

function createCalendarEvent(data) {
  try {
    var cal = CalendarApp.getDefaultCalendar();
    var start = new Date(data.start);
    var end = new Date(data.end);
    var options = { description: data.description || '', location: data.location || '' };
    if (data.guests && data.guests.length > 0) {
      options.guests = data.guests.map(function(g){ return g.email || g.name; }).join(',');
      options.sendInvites = true;
    }
    var event;
    if (data.isAllDay) event = cal.createAllDayEvent(data.title, start, options);
    else event = cal.createEvent(data.title, start, end, options);
    return JSON.stringify({ success: true, id: event.getId() });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function updateCalendarEvent(data) {
  try {
    var event = CalendarApp.getDefaultCalendar().getEventById(data.id);
    if (!event) return JSON.stringify({ success: false, error: "Evento não encontrado" });
    
    // Atualiza horário
    if (data.start && data.end) {
        event.setTime(new Date(data.start), new Date(data.end));
    }
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function deleteCalendarEvent(id) {
  try { var e = CalendarApp.getDefaultCalendar().getEventById(id); if(e) e.deleteEvent(); return JSON.stringify({ success: true }); } catch(e) { return JSON.stringify({ success: false }); }
}

// --- DRIVE SERVICES ---
function getDriveItems(params) {
  var folderId = params.folderId;
  var category = params.category || 'root'; 
  var query = params.query || '';
  var files = []; var folders = []; var currentFolderName = "Meu Drive";
  try {
    if (query) {
      var searchFiles = DriveApp.searchFiles('trashed = false and title contains "' + query + '"');
      while (searchFiles.hasNext() && files.length < 50) processFile(searchFiles.next(), files);
    } else if (category === 'recent') {
      var recentFiles = DriveApp.searchFiles('trashed = false');
      var temp = []; var count = 0;
      while (recentFiles.hasNext() && count < 30) { temp.push(recentFiles.next()); count++; }
      temp.sort(function(a,b){ return b.getLastUpdated().getTime() - a.getLastUpdated().getTime() });
      temp.forEach(function(f){ processFile(f, files); });
    } else {
      var folder = (folderId && folderId !== 'root') ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
      currentFolderName = folder.getName();
      var folderIter = folder.getFolders();
      while (folderIter.hasNext()) folders.push(processFolderObj(folderIter.next()));
      var fileIter = folder.getFiles();
      while (fileIter.hasNext()) processFile(fileIter.next(), files);
    }
  } catch (e) { }
  return JSON.stringify({ category: category, currentFolderId: folderId || 'root', currentFolderName: currentFolderName, folders: folders, files: files });
}

// Drive Helpers
function createDriveFolder(name, parentId) { try { var p = (parentId && parentId!=='root') ? DriveApp.getFolderById(parentId) : DriveApp.getRootFolder(); return JSON.stringify({success:true, id: p.createFolder(name).getId()}); } catch(e){ return JSON.stringify({success:false}); } }
function renameDriveItem(id, newName) { try { DriveApp.getFileById(id).setName(newName); return JSON.stringify({success:true}); } catch(e){ try{ DriveApp.getFolderById(id).setName(newName); return JSON.stringify({success:true}); }catch(e2){return JSON.stringify({success:false});} } }
function trashDriveItem(id) { try { DriveApp.getFileById(id).setTrashed(true); return JSON.stringify({success:true}); } catch(e){ try{ DriveApp.getFolderById(id).setTrashed(true); return JSON.stringify({success:true}); }catch(e2){return JSON.stringify({success:false});} } }
function setStarredDriveItem(id, starred) { try { DriveApp.getFileById(id).setStarred(starred); return JSON.stringify({success:true}); } catch(e){ try{ DriveApp.getFolderById(id).setStarred(starred); return JSON.stringify({success:true}); }catch(e2){return JSON.stringify({success:false});} } }
function uploadFileToDrive(data, name, mimeType, parentId) { try { var p = (parentId && parentId!=='root') ? DriveApp.getFolderById(parentId) : DriveApp.getRootFolder(); p.createFile(Utilities.newBlob(Utilities.base64Decode(data), mimeType, name)); return JSON.stringify({success:true}); } catch(e){ return JSON.stringify({success:false}); } }

function getFileContent(id) { 
  try { 
    var file = DriveApp.getFileById(id); 
    var mimeType = file.getMimeType();
    var blob;

    // Converte Docs/Sheets/Slides para PDF para preview
    if (mimeType === MimeType.GOOGLE_DOCS || mimeType === MimeType.GOOGLE_SHEETS || mimeType === MimeType.GOOGLE_SLIDES) {
        blob = file.getAs(MimeType.PDF);
        return JSON.stringify({
            success: true, 
            data: Utilities.base64Encode(blob.getBytes()), 
            mimeType: 'application/pdf', 
            name: file.getName() + ".pdf"
        });
    }
    
    // Se for texto/html/json, retorna o conteúdo como string decodificável
    if (mimeType === MimeType.PLAIN_TEXT || mimeType === MimeType.HTML || mimeType === 'application/json' || mimeType.includes('script')) {
       return JSON.stringify({
            success: true, 
            data: Utilities.base64Encode(file.getBlob().getBytes()), 
            mimeType: mimeType, 
            name: file.getName()
        });
    }

    if(file.getSize() > 10*1024*1024) return JSON.stringify({success:false, error: "Arquivo muito grande"}); 
    
    blob = file.getBlob();
    return JSON.stringify({
        success: true, 
        data: Utilities.base64Encode(blob.getBytes()), 
        mimeType: mimeType, 
        name: file.getName()
    }); 
  } catch(e){ 
    return JSON.stringify({success:false, error: e.toString()}); 
  } 
}

// Salvar conteúdo em arquivo (Simulação de Editor)
function saveFileContent(id, content) {
  try {
    var file = DriveApp.getFileById(id);
    // Suporta salvar texto plano, HTML, JSON. Docs Google requer conversão complexa não suportada nativamente sem API avançada.
    file.setContent(content);
    return JSON.stringify({ success: true });
  } catch(e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

function processFolderObj(f) { return { id: f.getId(), name: f.getName(), type: 'folder', owner: 'Eu', date: formatDateSmart(f.getLastUpdated()), isStarred: f.isStarred() }; }
function processFile(f, list) { list.push({ id: f.getId(), name: f.getName(), type: mapMimeTypeToIcon(f.getMimeType()), mimeType: f.getMimeType(), owner: 'Eu', date: formatDateSmart(f.getLastUpdated()), size: formatBytes(f.getSize()), isStarred: f.isStarred() }); }
function formatDateSmart(date) { var now = new Date(); if (date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); return date.toLocaleDateString([], {day: '2-digit', month: '2-digit'}); }
function mapMimeTypeToIcon(mime) { if(mime.indexOf('spreadsheet')!==-1||mime.indexOf('excel')!==-1) return 'sheet'; if(mime.indexOf('presentation')!==-1||mime.indexOf('powerpoint')!==-1) return 'slide'; if(mime.indexOf('document')!==-1||mime.indexOf('word')!==-1) return 'doc'; if(mime.indexOf('image')!==-1) return 'image'; if(mime.indexOf('pdf')!==-1) return 'pdf'; return 'file'; }
function formatBytes(bytes, decimals) { if(bytes==0) return '0 Bytes'; var k=1024, dm=decimals||2, sizes=['Bytes','KB','MB','GB'], i=Math.floor(Math.log(bytes)/Math.log(k)); return parseFloat((bytes/Math.pow(k, i)).toFixed(dm))+' '+sizes[i]; }
