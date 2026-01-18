
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Workspace Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Função principal que hidrata a aplicação React com dados reais.
 */
function getInitialData() {
  var userEmail = Session.getActiveUser().getEmail();
  
  var user = {
    email: userEmail,
    name: userEmail.split('@')[0], 
    avatar: "https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/4252rscbv5M/photo.jpg" 
  };
  
  var emails = getEmailsMockOrReal();
  var events = getEventsMockOrReal();
  var files = getRecentFilesSimple();

  var response = {
    user: user,
    emails: emails,
    events: events,
    files: files,
    weather: { temp: "24°", location: "Online" },
    stats: { storageUsed: 0, unreadEmails: GmailApp.getInboxUnreadCount() },
    tasks: [],
    notes: []
  };

  return JSON.stringify(response);
}

// --- GMAIL OPERATIONS ---

function manageEmail(id, action) {
  try {
    var thread = GmailApp.getThreadById(id);
    if (!thread) return JSON.stringify({ success: false, error: "Email não encontrado" });

    if (action === 'read') thread.markRead();
    else if (action === 'unread') thread.markUnread();
    else if (action === 'archive') thread.moveToArchive();
    else if (action === 'trash') thread.moveToTrash();
    else if (action === 'spam') thread.moveToSpam();
    else if (action === 'star') thread.addLabel(GmailApp.getUserLabelByName("Starred") || GmailApp.createLabel("Starred")); // Fallback simples
    
    return JSON.stringify({ success: true });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

function sendEmail(to, subject, body) {
  try { 
    GmailApp.sendEmail(to, subject, body); 
    return JSON.stringify({ success: true }); 
  } catch(e) { 
    return JSON.stringify({ success: false, error: e.message }); 
  }
}

// --- CALENDAR OPERATIONS ---

function createCalendarEvent(data) {
  try {
    var cal = CalendarApp.getDefaultCalendar();
    var start = new Date(data.start);
    var end = new Date(data.end);
    var options = {
      description: data.description || '',
      location: data.location || ''
    };
    
    if (data.guests) {
      options.guests = data.guests.map(function(g){ return g.email || g.name; }).join(',');
    }

    var event;
    if (data.isAllDay) {
      event = cal.createAllDayEvent(data.title, start, options);
    } else {
      event = cal.createEvent(data.title, start, end, options);
    }

    // Simulação de adição de Meet (Apps Script padrão não adiciona link meet nativamente fácil sem Advanced Services, então adicionamos ao local/descrição)
    if (data.addMeet) {
      var meetLink = "https://meet.google.com/new"; // Em produção usaria Advanced Calendar Service
      event.setLocation("Google Meet: " + meetLink);
    }

    return JSON.stringify({ success: true, id: event.getId() });
  } catch(e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

function deleteCalendarEvent(id) {
  try {
    var cal = CalendarApp.getDefaultCalendar();
    var event = cal.getEventById(id);
    if (event) {
      event.deleteEvent();
      return JSON.stringify({ success: true });
    }
    return JSON.stringify({ success: false, error: "Evento não encontrado" });
  } catch(e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

// --- DRIVE OPERATIONS ---

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
      currentFolderName = 'Resultados para "' + query + '"';
      var search = 'trashed = false and (title contains "' + query + '")';
      var iter = DriveApp.searchFiles(search);
      while (iter.hasNext() && files.length < 50) processFile(iter.next(), files);
      
      var folderIter = DriveApp.searchFolders('trashed = false and (title contains "' + query + '")');
      while (folderIter.hasNext() && folders.length < 20) {
         var f = folderIter.next();
         folders.push(processFolderObj(f));
      }

    } else if (category === 'recent') {
      currentFolderName = "Recentes";
      var iter = DriveApp.searchFiles('trashed = false');
      while (iter.hasNext() && files.length < 50) processFile(iter.next(), files);
      files.sort(function(a, b) { return new Date(b.dateRaw) - new Date(a.dateRaw); });
      
    } else if (category === 'starred') {
      currentFolderName = "Com Estrela";
      var iter = DriveApp.searchFiles('starred = true and trashed = false');
      while (iter.hasNext() && files.length < 50) processFile(iter.next(), files);
      
    } else if (category === 'trash') {
      currentFolderName = "Lixeira";
      var iter = DriveApp.searchFiles('trashed = true');
      while (iter.hasNext() && files.length < 50) processFile(iter.next(), files);

    } else {
      var folder;
      if (folderId && folderId !== 'root') {
        folder = DriveApp.getFolderById(folderId);
      } else {
        folder = DriveApp.getRootFolder();
      }
      
      currentFolderName = folder.getName();
      try { 
        var parents = folder.getParents();
        if (parents.hasNext()) parentId = parents.next().getId();
      } catch(e) {} 

      var folderIter = folder.getFolders();
      while (folderIter.hasNext()) {
        folders.push(processFolderObj(folderIter.next()));
      }

      var fileIter = folder.getFiles();
      while (fileIter.hasNext()) {
        processFile(fileIter.next(), files);
      }
    }
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }

  return JSON.stringify({
    category: category,
    currentFolderId: folderId,
    currentFolderName: currentFolderName,
    parentId: parentId,
    folders: folders,
    files: files
  });
}

function createDriveFolder(name, parentId) {
  try {
    var parent = parentId && parentId !== 'root' ? DriveApp.getFolderById(parentId) : DriveApp.getRootFolder();
    var newFolder = parent.createFolder(name);
    return JSON.stringify({ success: true, id: newFolder.getId() });
  } catch(e) { return JSON.stringify({ success: false, error: e.message }); }
}

function renameDriveItem(id, newName) {
  try {
    var file = DriveApp.getFileById(id);
    file.setName(newName);
    return JSON.stringify({ success: true });
  } catch(e) {
    try {
      var folder = DriveApp.getFolderById(id);
      folder.setName(newName);
      return JSON.stringify({ success: true });
    } catch(e2) { return JSON.stringify({ success: false }); }
  }
}

function trashDriveItem(id) {
  try {
    var file = DriveApp.getFileById(id);
    file.setTrashed(true);
    return JSON.stringify({ success: true });
  } catch(e) {
    try {
      var folder = DriveApp.getFolderById(id);
      folder.setTrashed(true);
      return JSON.stringify({ success: true });
    } catch(e2) { return JSON.stringify({ success: false }); }
  }
}

function setStarredDriveItem(id, starred) {
  try {
    var file = DriveApp.getFileById(id);
    file.setStarred(starred);
    return JSON.stringify({ success: true });
  } catch(e) {
    try {
      var folder = DriveApp.getFolderById(id);
      folder.setStarred(starred);
      return JSON.stringify({ success: true });
    } catch(e2) { return JSON.stringify({ success: false }); }
  }
}

function uploadFileToDrive(data, name, mimeType, parentId) {
  try {
    var blob = Utilities.newBlob(Utilities.base64Decode(data), mimeType, name);
    var parent = parentId && parentId !== 'root' ? DriveApp.getFolderById(parentId) : DriveApp.getRootFolder();
    var file = parent.createFile(blob);
    return JSON.stringify({ success: true, id: file.getId() });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

function getFileContent(id) {
  try {
    var file = DriveApp.getFileById(id);
    var blob = file.getBlob();
    return JSON.stringify({
      success: true,
      data: Utilities.base64Encode(blob.getBytes()),
      mimeType: file.getMimeType(),
      name: file.getName()
    });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

// --- HELPERS ---

function processFolderObj(f) {
  return {
    id: f.getId(),
    name: f.getName(),
    type: 'folder',
    owner: f.getOwner() ? f.getOwner().getName() : 'Eu',
    date: formatDateSmart(f.getLastUpdated()),
    dateRaw: f.getLastUpdated().toISOString(),
    size: '-',
    isStarred: f.isStarred()
  };
}

function processFile(f, list) {
  list.push({
    id: f.getId(),
    name: f.getName(),
    type: mapMimeTypeToIcon(f.getMimeType()),
    mimeType: f.getMimeType(),
    owner: f.getOwner() ? f.getOwner().getName() : 'Eu',
    date: formatDateSmart(f.getLastUpdated()),
    dateRaw: f.getLastUpdated().toISOString(),
    size: formatBytes(f.getSize()),
    thumbnail: hasThumbnail(f) ? f.getThumbnail() : null,
    isStarred: f.isStarred()
  });
}

function hasThumbnail(f) {
  var mime = f.getMimeType();
  return mime.indexOf('image/') !== -1;
}

function getEmailsMockOrReal() {
  try {
    var threads = GmailApp.getInboxThreads(0, 15);
    return threads.map(function(t) {
      var m = t.getMessages()[0];
      return {
        id: t.getId(),
        subject: t.getFirstMessageSubject(),
        sender: m.getFrom().split('<')[0].replace(/"/g,'').trim(),
        senderInit: m.getFrom().charAt(0).toUpperCase(),
        time: formatDateSmart(m.getDate()),
        preview: m.getPlainBody().substring(0,80)+"...",
        read: !t.isUnread(),
        hasAttachment: m.getAttachments().length > 0,
        labels: t.getLabels().map(function(l){return l.getName()}),
        isStarred: t.hasStarredMessages()
      };
    });
  } catch (e) { return []; }
}

function getEventsMockOrReal() {
  try {
    var now = new Date();
    // Pega eventos de 30 dias atrás até 30 dias no futuro para preencher a view mensal
    var start = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    var end = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    var events = CalendarApp.getDefaultCalendar().getEvents(start, end);
    
    return events.map(function(e) {
      return {
        id: e.getId(),
        title: e.getTitle(),
        start: e.getStartTime().toISOString(),
        end: e.getEndTime().toISOString(),
        location: e.getLocation(),
        isAllDay: e.isAllDayEvent(),
        color: 'bg-blue-500', // Default color, mapping real GCal colors is complex due to ColorID enums
        guests: e.getGuestList().map(function(g){ return {name: g.getEmail(), email: g.getEmail(), avatar: g.getEmail().charAt(0).toUpperCase()}; }),
        recurrence: e.isRecurring() ? 'daily' : 'none' // Simplificação
      };
    });
  } catch (e) { return []; }
}

function getRecentFilesSimple() {
  var files = [];
  try {
    var iter = DriveApp.searchFiles('trashed = false');
    var i = 0;
    while(iter.hasNext() && i < 6) {
      var f = iter.next();
      files.push({
        id: f.getId(),
        name: f.getName(),
        type: mapMimeTypeToIcon(f.getMimeType()),
        date: formatDateSmart(f.getLastUpdated())
      });
      i++;
    }
  } catch(e) {}
  return files;
}

function formatDateSmart(date) {
  var now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }
  return date.toLocaleDateString([], {day: '2-digit', month: '2-digit'});
}

function mapMimeTypeToIcon(mime) {
  if(mime.indexOf('spreadsheet') !== -1) return 'sheet';
  if(mime.indexOf('presentation') !== -1) return 'slide';
  if(mime.indexOf('document') !== -1 || mime.indexOf('text') !== -1) return 'doc';
  if(mime.indexOf('image') !== -1) return 'image';
  if(mime.indexOf('folder') !== -1) return 'folder';
  if(mime.indexOf('pdf') !== -1) return 'pdf';
  return 'file';
}

function formatBytes(bytes, decimals) {
  if (bytes == 0) return '0 Bytes';
  var k = 1024,
      dm = decimals || 2,
      sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
      i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
