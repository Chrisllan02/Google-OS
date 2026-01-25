
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
    
    // Fetch initial batch
    var emails = getEmailsReal(0, 20, 'inbox', ''); 
    var events = getEventsReal(); 
    var tasks = getTasksReal();
    var notes = getNotesReal();
    
    var files = [];
    try {
        var driveData = JSON.parse(getDriveItems({ folderId: 'root' }));
        files = driveData.files; 
    } catch(e) {}
    
    var storageUsed = 0; 
    try { storageUsed = DriveApp.getStorageUsed(); } catch(e) {}
    
    var response = {
      user: user,
      emails: emails,
      events: events,
      tasks: tasks,
      notes: notes,
      files: files, 
      weather: { temp: "24°", location: "Corporativo" },
      stats: { storageUsed: Math.round(storageUsed / (1024*1024)), unreadEmails: GmailApp.getInboxUnreadCount() }
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

// --- CONTACTS SERVICE ---
function searchContacts(query) {
    try {
        if (!query || query.length < 2) return JSON.stringify([]);
        var contacts = ContactsApp.getContactsByName(query);
        var byEmail = ContactsApp.getContactsByEmailAddress(query);
        // Combine and dedup
        var combined = contacts.concat(byEmail);
        var unique = {};
        var results = [];
        
        for (var i = 0; i < combined.length && results.length < 10; i++) {
            var c = combined[i];
            var emails = c.getEmails();
            if (emails.length > 0) {
                var email = emails[0].getAddress();
                if (!unique[email]) {
                    unique[email] = true;
                    results.push({
                        name: c.getFullName() || email,
                        email: email,
                        avatar: c.getFullName() ? c.getFullName().charAt(0).toUpperCase() : email.charAt(0).toUpperCase(),
                        color: 'bg-blue-600' // Default color
                    });
                }
            }
        }
        return JSON.stringify(results);
    } catch(e) { return JSON.stringify([]); }
}

// --- TASKS OPERATIONS ---
function getTasksReal() { return loadDB('tasks.json'); }
function createTask(title, details) { 
  var tasks = getTasksReal(); 
  var newTask = { id: new Date().getTime(), title: title, details: details || "", completed: false, date: new Date().toISOString() }; 
  tasks.unshift(newTask); 
  saveDB('tasks.json', tasks); 
  return JSON.stringify({ success: true, task: newTask }); 
}
function toggleTask(id) { var tasks = getTasksReal(); var updated = false; tasks = tasks.map(function(t) { if (t.id == id) { t.completed = !t.completed; updated = true; } return t; }); if(updated) saveDB('tasks.json', tasks); return JSON.stringify({ success: updated }); }
function deleteTask(id) { var tasks = getTasksReal(); var initialLen = tasks.length; tasks = tasks.filter(function(t) { return t.id != id; }); if (tasks.length !== initialLen) saveDB('tasks.json', tasks); return JSON.stringify({ success: true }); }

// --- KEEP NOTES OPERATIONS ---
function getNotesReal() { return loadDB('notes.json'); }
function saveNote(note) { var notes = getNotesReal(); var existingIndex = notes.findIndex(function(n){ return n.id == note.id; }); if (existingIndex >= 0) { notes[existingIndex] = note; } else { notes.unshift(note); } saveDB('notes.json', notes); return JSON.stringify({ success: true }); }
function deleteNote(id) { var notes = getNotesReal(); var initialLen = notes.length; notes = notes.filter(function(n) { return n.id != id; }); if (notes.length !== initialLen) saveDB('notes.json', notes); return JSON.stringify({ success: true }); }

// --- MAIL SERVICES ---
function getEmailsReal(start, limit, folderId, query) {
  try {
    var startIdx = start || 0;
    var limitCount = limit || 20;
    var threads;
    
    // Construct search query
    var searchQuery = query || '';
    if (folderId === 'starred') searchQuery += ' is:starred';
    else if (folderId === 'trash') searchQuery += ' in:trash';
    else if (folderId === 'spam') searchQuery += ' in:spam';
    else if (folderId === 'sent') searchQuery += ' in:sent';
    else if (folderId === 'drafts') searchQuery += ' in:drafts';
    else if (folderId && folderId.indexOf('label_') === 0) {
       searchQuery += ' label:' + folderId.replace('label_', '');
    } else if (folderId === 'inbox' || !folderId) {
       searchQuery += ' in:inbox';
    }

    if (searchQuery.trim() !== '') {
       threads = GmailApp.search(searchQuery, startIdx, limitCount);
    } else {
       threads = GmailApp.getInboxThreads(startIdx, limitCount);
    }

    return threads.map(function(t) {
      var msgs = t.getMessages();
      var lastMsg = msgs[msgs.length-1]; 
      var subject = t.getFirstMessageSubject() || "(Sem assunto)";
      
      // Determine avatar color based on sender name/email hash equivalent
      var senderName = lastMsg.getFrom().replace(/<.*?>/g, "").trim();
      var colorClass = getColorForString(senderName);

      return {
        id: t.getId(),
        subject: subject,
        sender: senderName,
        senderInit: senderName.charAt(0).toUpperCase(),
        color: colorClass,
        time: formatDateSmart(lastMsg.getDate()),
        preview: lastMsg.getPlainBody().substring(0, 90) + "...",
        read: !t.isUnread(),
        hasAttachment: msgs.some(function(msg){ return msg.getAttachments().length > 0 }),
        labels: t.getLabels().map(function(l) { return l.getName(); }),
        isStarred: t.hasStarredMessages(),
        folder: folderId || 'inbox',
        messageCount: t.getMessageCount(),
        to: lastMsg.getTo() 
      };
    });
  } catch (e) { return []; }
}

function getEmailsPaged(start, limit, folder, query) { 
    return JSON.stringify(getEmailsReal(start, limit, folder, query)); 
}

function getThreadDetails(threadId) {
  try {
    var thread = GmailApp.getThreadById(threadId);
    var messages = thread.getMessages();
    var details = messages.map(function(m) {
      var body = m.getBody();
      // Basic sanitization to prevent breaking the app UI (simplified)
      // In production, use a more robust sanitizer or iframe
      
      return {
        id: m.getId(),
        from: m.getFrom().replace(/<.*?>/g, "").trim(),
        senderInit: m.getFrom().charAt(0).toUpperCase(),
        to: m.getTo(),
        date: formatDateSmart(m.getDate()),
        body: body, 
        plainBody: m.getPlainBody().substring(0, 200) + "...",
        attachments: m.getAttachments().map(function(att, index) {
           return { name: att.getName(), mimeType: att.getContentType(), size: formatBytes(att.getSize()), id: index };
        })
      };
    });
    
    // Mark as read when details are fetched
    if (thread.isUnread()) thread.markRead();
    
    return JSON.stringify({ success: true, messages: details, subject: thread.getFirstMessageSubject() });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function createGmailLabel(name) {
    try { GmailApp.createLabel(name); return JSON.stringify({ success: true }); } 
    catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function sendEmail(to, subject, bodyHTML, attachmentsData) {
  try {
    var options = { htmlBody: bodyHTML };
    if (attachmentsData && attachmentsData.length > 0) {
      // Decode attachments
      var blobs = attachmentsData.map(function(att) { 
          return Utilities.newBlob(Utilities.base64Decode(att.data), att.mimeType, att.name); 
      });
      options.attachments = blobs;
    }
    GmailApp.sendEmail(to, subject, bodyHTML.replace(/<[^>]+>/g, ''), options);
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function saveDraftReal(to, subject, bodyHTML) {
    try {
        GmailApp.createDraft(to, subject, bodyHTML.replace(/<[^>]+>/g, ''), { htmlBody: bodyHTML });
        return JSON.stringify({ success: true });
    } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function batchManageEmails(ids, action) {
  try {
    if (!ids || ids.length === 0) return JSON.stringify({ success: true });
    
    for (var i = 0; i < ids.length; i++) {
        var thread = GmailApp.getThreadById(ids[i]);
        if (thread) {
            if (action === 'read') thread.markRead();
            else if (action === 'unread') thread.markUnread();
            else if (action === 'archive') thread.moveToArchive();
            else if (action === 'trash') thread.moveToTrash();
            else if (action === 'spam') thread.moveToSpam();
        }
    }
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function getEmailAttachmentContent(messageId, attachmentIndex) {
  try {
    var msg = GmailApp.getMessageById(messageId);
    var atts = msg.getAttachments();
    if (attachmentIndex >= 0 && attachmentIndex < atts.length) {
      var blob = atts[attachmentIndex];
      // Limit attachment size for base64 return to avoid crashing script
      if (blob.getSize() > 5 * 1024 * 1024) {
          return JSON.stringify({ success: false, error: "Anexo muito grande para visualização." });
      }
      return JSON.stringify({ success: true, data: Utilities.base64Encode(blob.getBytes()), mimeType: blob.getContentType(), name: blob.getName() });
    }
    return JSON.stringify({ success: false, error: "Anexo não encontrado" });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

// --- CALENDAR SERVICES ---
// Maps Google Calendar colors (1-11) to our UI palette
function getEventColorClass(colorId) {
    var map = { 
        '1': 'bg-[#7986CB]', // Lavender
        '2': 'bg-[#33B679]', // Sage
        '3': 'bg-[#8E24AA]', // Grape
        '4': 'bg-[#E67C73]', // Flamingo
        '5': 'bg-[#F6BF26]', // Banana
        '6': 'bg-[#F4511E]', // Tangerine
        '7': 'bg-[#039BE5]', // Peacock (Default Blue)
        '8': 'bg-[#616161]', // Graphite
        '9': 'bg-[#3F51B5]', // Blueberry
        '10': 'bg-[#0B8043]', // Basil
        '11': 'bg-[#D50000]'  // Tomato
    };
    return map[colorId] || 'bg-[#039BE5]'; 
}

function getEventsReal(startDateStr, endDateStr) {
  try {
    var start, end;
    if (startDateStr && endDateStr) { start = new Date(startDateStr); end = new Date(endDateStr); } 
    else { var now = new Date(); start = new Date(now.getTime() - (15 * 86400000)); end = new Date(now.getTime() + (45 * 86400000)); }
    
    var cal = CalendarApp.getDefaultCalendar();
    var events = cal.getEvents(start, end);
    
    return events.map(function(e) {
      var desc = e.getDescription();
      var meetLink = "";
      var location = e.getLocation();
      
      // Extract Meet Link
      if (location && location.indexOf('meet.google.com') > -1) meetLink = location;
      else if (desc && desc.indexOf('meet.google.com') > -1) {
          var match = desc.match(/https:\/\/meet\.google\.com\/[a-z-]+/);
          if (match) meetLink = match[0];
      }
      
      var recurrence = e.isRecurringEvent() ? 'recurring' : 'none';
      
      return {
        id: e.getId(), 
        title: e.getTitle(), 
        start: e.getStartTime().toISOString(), 
        end: e.getEndTime().toISOString(),
        location: location, 
        meetLink: meetLink, 
        isAllDay: e.isAllDayEvent(), 
        color: getEventColorClass(e.getColor()), 
        colorId: e.getColor() || '7', 
        description: desc,
        guests: e.getGuestList().map(function(g){ 
            return {
                name: g.getEmail(), 
                email: g.getEmail(), 
                status: g.getGuestStatus().toString(), // INVITED, YES, NO, MAYBE
                avatar: g.getEmail().charAt(0).toUpperCase()
            }; 
        }),
        recurrence: recurrence 
      };
    });
  } catch (e) { return []; }
}

function createCalendarEvent(data) { 
  try { 
    var cal = CalendarApp.getDefaultCalendar(); 
    var start = new Date(data.start); 
    var end = new Date(data.end); 
    var description = data.description || '';
    var location = data.location || '';
    
    if (data.useMeet) {
       // Mocking Meet link creation as Apps Script doesn't support generating new Meet links directly easily without Advanced Services
       var meetCode = Math.random().toString(36).substring(7);
       var meetLink = "https://meet.google.com/" + "abc-" + meetCode + "-xyz";
       description = (description ? description + "\n\n" : "") + "Participar com Google Meet: " + meetLink;
       location = location ? location + " | " + meetLink : meetLink;
    }
    
    var options = { description: description, location: location }; 
    if (data.guests && data.guests.length > 0) { 
        options.guests = data.guests.map(function(g){ return g.email || g.name; }).join(','); 
        options.sendInvites = true; 
    } 
    
    var event; 
    if (data.recurrence === 'daily') {
        var recurrence = CalendarApp.newRecurrence().addDailyRule();
        if (data.isAllDay) event = cal.createAllDayEventSeries(data.title, start, recurrence, options);
        else event = cal.createEventSeries(data.title, start, end, recurrence, options);
    } else if (data.recurrence === 'weekly') {
        var recurrence = CalendarApp.newRecurrence().addWeeklyRule();
        if (data.isAllDay) event = cal.createAllDayEventSeries(data.title, start, recurrence, options);
        else event = cal.createEventSeries(data.title, start, end, recurrence, options);
    } else {
        if (data.isAllDay) event = cal.createAllDayEvent(data.title, start, options); 
        else event = cal.createEvent(data.title, start, end, options); 
    }
    
    if (data.colorId) { try { event.setColor(data.colorId); } catch(e){} }
    
    return JSON.stringify({ success: true, id: event.getId() }); 
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); } 
}

function updateCalendarEvent(data) { 
  try { 
    var cal = CalendarApp.getDefaultCalendar();
    var event = cal.getEventById(data.id); 
    if (!event) return JSON.stringify({ success: false, error: "Evento não encontrado" }); 
    
    if (data.start && data.end) {
        if (data.isAllDay) { 
            if(!event.isAllDayEvent()) event.setAllDayDate(new Date(data.start)); 
        } else { 
            event.setTime(new Date(data.start), new Date(data.end)); 
        }
    }
    if (data.title) event.setTitle(data.title);
    if (data.description) event.setDescription(data.description);
    if (data.location) event.setLocation(data.location);
    if (data.colorId) { try { event.setColor(data.colorId); } catch(e){} }
    
    return JSON.stringify({ success: true }); 
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); } 
}

function deleteCalendarEvent(id, deleteAll) { 
    try { 
        var e = CalendarApp.getDefaultCalendar().getEventById(id); 
        if(e) {
            if (deleteAll && e.isRecurringEvent()) {
                var series = e.getEventSeries();
                if(series) series.deleteEventSeries();
            } else {
                e.deleteEvent();
            }
        }
        return JSON.stringify({ success: true }); 
    } catch(e) { return JSON.stringify({ success: false }); } 
}

// --- DRIVE SERVICES ---
function getDriveItems(params) { 
    var folderId = params.folderId; 
    var category = params.category || 'root'; 
    var query = params.query || ''; 
    var files = []; 
    var folders = []; 
    var currentFolderName = "Meu Drive"; 
    var parentId = null; 
    
    try { 
        if (query) { 
            var searchFiles = DriveApp.searchFiles('trashed = false and title contains "' + query + '"'); 
            while (searchFiles.hasNext() && files.length < 50) processFile(searchFiles.next(), files); 
        } else if (category === 'recent') { 
            // Inefficient but standard way in GAS without Advanced Drive Service
            var recentFiles = DriveApp.searchFiles('trashed = false'); 
            var temp = []; 
            var count = 0; 
            while (recentFiles.hasNext() && count < 30) { temp.push(recentFiles.next()); count++; } 
            temp.sort(function(a,b){ return b.getLastUpdated().getTime() - a.getLastUpdated().getTime() }); 
            temp.forEach(function(f){ processFile(f, files); }); 
        } else if (category === 'starred') {
            var starred = DriveApp.searchFiles('trashed = false and starred = true');
            while (starred.hasNext() && files.length < 50) processFile(starred.next(), files);
        } else { 
            var folder = (folderId && folderId !== 'root') ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder(); 
            currentFolderName = folder.getName(); 
            var parents = folder.getParents(); 
            if (parents.hasNext()) { parentId = parents.next().getId(); } 
            else { parentId = 'root'; } 
            
            var folderIter = folder.getFolders(); 
            while (folderIter.hasNext()) folders.push(processFolderObj(folderIter.next())); 
            
            var fileIter = folder.getFiles(); 
            while (fileIter.hasNext()) processFile(fileIter.next(), files); 
        } 
    } catch (e) { } 
    return JSON.stringify({ category: category, currentFolderId: folderId || 'root', currentFolderName: currentFolderName, parentId: parentId, folders: folders, files: files }); 
}

function createDriveFolder(name, parentId) { try { var p = (parentId && parentId!=='root') ? DriveApp.getFolderById(parentId) : DriveApp.getRootFolder(); return JSON.stringify({success:true, id: p.createFolder(name).getId()}); } catch(e){ return JSON.stringify({success:false}); } }
function renameDriveItem(id, newName) { try { DriveApp.getFileById(id).setName(newName); return JSON.stringify({success:true}); } catch(e){ try{ DriveApp.getFolderById(id).setName(newName); return JSON.stringify({success:true}); }catch(e2){return JSON.stringify({success:false});} } }
function trashDriveItem(id) { try { DriveApp.getFileById(id).setTrashed(true); return JSON.stringify({success:true}); } catch(e){ try{ DriveApp.getFolderById(id).setTrashed(true); return JSON.stringify({success:true}); }catch(e2){return JSON.stringify({success:false});} } }
function setStarredDriveItem(id, starred) { try { DriveApp.getFileById(id).setStarred(starred); return JSON.stringify({success:true}); } catch(e){ try{ DriveApp.getFolderById(id).setStarred(starred); return JSON.stringify({success:true}); }catch(e2){return JSON.stringify({success:false});} } }
function uploadFileToDrive(data, name, mimeType, parentId) { try { var p = (parentId && parentId!=='root') ? DriveApp.getFolderById(parentId) : DriveApp.getRootFolder(); p.createFile(Utilities.newBlob(Utilities.base64Decode(data), mimeType, name)); return JSON.stringify({success:true}); } catch(e){ return JSON.stringify({success:false}); } }
function moveDriveItem(itemId, targetFolderId) { try { var target = (targetFolderId && targetFolderId !== 'root') ? DriveApp.getFolderById(targetFolderId) : DriveApp.getRootFolder(); try { var file = DriveApp.getFileById(itemId); file.moveTo(target); return JSON.stringify({ success: true }); } catch(e) { try { var folder = DriveApp.getFolderById(itemId); folder.moveTo(target); return JSON.stringify({ success: true }); } catch(e2) { return JSON.stringify({ success: false, error: "Item not found" }); } } } catch(e) { return JSON.stringify({ success: false, error: e.toString() }); } }

function getFileContent(id) { 
    try { 
        var file = DriveApp.getFileById(id); 
        var mimeType = file.getMimeType(); 
        var blob; 
        
        // Convert Google Docs/Sheets to PDF for preview
        if (mimeType === MimeType.GOOGLE_DOCS || mimeType === MimeType.GOOGLE_SHEETS || mimeType === MimeType.GOOGLE_SLIDES) { 
            // In a real app we might convert to HTML or text, but PDF is safest for 'preview'
            // For editing, we need different logic (like getAs('text/plain') for docs)
            if (mimeType === MimeType.GOOGLE_DOCS) {
               // Try to get as plain text for our simple editor
               return JSON.stringify({ success: true, data: Utilities.base64Encode(file.getAs('text/plain').getBytes()), mimeType: 'text/plain', name: file.getName() });
            }
            blob = file.getAs(MimeType.PDF); 
            return JSON.stringify({ success: true, data: Utilities.base64Encode(blob.getBytes()), mimeType: 'application/pdf', name: file.getName() + ".pdf" }); 
        } 
        
        if (mimeType === MimeType.PLAIN_TEXT || mimeType === MimeType.HTML || mimeType === 'application/json' || mimeType.includes('script') || mimeType.includes('csv')) { 
            return JSON.stringify({ success: true, data: Utilities.base64Encode(file.getBlob().getBytes()), mimeType: mimeType, name: file.getName() }); 
        } 
        
        if(file.getSize() > 10*1024*1024) return JSON.stringify({success:false, error: "Arquivo muito grande"}); 
        
        blob = file.getBlob(); 
        return JSON.stringify({ success: true, data: Utilities.base64Encode(blob.getBytes()), mimeType: mimeType, name: file.getName() }); 
    } catch(e){ return JSON.stringify({success:false, error: e.toString()}); } 
}

function saveFileContent(id, content) { 
    try { 
        // Note: DriveApp cannot write directly to Google Docs/Sheets files using setContent.
        // It only works for text files stored in Drive.
        // For Docs, we would need DocumentApp.openById(id).getBody().setText(content)
        var file = DriveApp.getFileById(id); 
        var mime = file.getMimeType();
        
        if (mime === MimeType.GOOGLE_DOCS) {
            DocumentApp.openById(id).getBody().setText(content); // Basic overwrite
        } else {
            file.setContent(content); 
        }
        return JSON.stringify({ success: true }); 
    } catch(e) { return JSON.stringify({ success: false, error: e.message }); } 
}

// Helpers
function processFolderObj(f) { return { id: f.getId(), name: f.getName(), type: 'folder', owner: 'Eu', date: formatDateSmart(f.getLastUpdated()), isStarred: f.isStarred() }; }
function processFile(f, list) { list.push({ id: f.getId(), name: f.getName(), type: mapMimeTypeToIcon(f.getMimeType()), mimeType: f.getMimeType(), owner: 'Eu', date: formatDateSmart(f.getLastUpdated()), size: formatBytes(f.getSize()), isStarred: f.isStarred() }); }
function formatDateSmart(date) { var now = new Date(); if (date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); return date.toLocaleDateString([], {day: '2-digit', month: '2-digit'}); }
function mapMimeTypeToIcon(mime) { if(mime.indexOf('spreadsheet')!==-1||mime.indexOf('excel')!==-1) return 'sheet'; if(mime.indexOf('presentation')!==-1||mime.indexOf('powerpoint')!==-1) return 'slide'; if(mime.indexOf('document')!==-1||mime.indexOf('word')!==-1) return 'doc'; if(mime.indexOf('image')!==-1) return 'image'; if(mime.indexOf('pdf')!==-1) return 'pdf'; return 'file'; }
function formatBytes(bytes, decimals) { if(bytes==0) return '0 Bytes'; var k=1024, dm=decimals||2, sizes=['Bytes','KB','MB','GB'], i=Math.floor(Math.log(bytes)/Math.log(k)); return parseFloat((bytes/Math.pow(k, i)).toFixed(dm))+' '+sizes[i]; }
function getColorForString(str) {
    var colors = ['bg-blue-600', 'bg-red-600', 'bg-green-600', 'bg-purple-600', 'bg-yellow-600', 'bg-pink-600'];
    var hash = 0;
    for (var i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}
