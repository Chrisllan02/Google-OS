// --- MAIN SERVING ---
function doGet() {
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('Workspace Dashboard')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// --- MEET SIGNALING ---
/**
 * Registra o PeerID associado a um código de sala amigável.
 */
function registerMeeting(roomCode, peerId) {
  try {
    var props = PropertiesService.getScriptProperties();
    // Armazena com expiração implícita (será sobreposto ou limpo manualmente)
    props.setProperty('meet_room_' + roomCode, peerId);
    return JSON.stringify({ success: true });
  } catch(e) {
    return JSON.stringify({ success: false, error: e.toString() });
  }
}

/**
 * Recupera o PeerID do Host de uma sala específica.
 */
function getMeetingPeer(roomCode) {
  try {
    var props = PropertiesService.getScriptProperties();
    var peerId = props.getProperty('meet_room_' + roomCode);
    return JSON.stringify({ peerId: peerId });
  } catch(e) {
    return JSON.stringify({ peerId: null, error: e.toString() });
  }
}

// --- DATA FETCHING ---
function getInitialData() {
  try {
    var userEmail = Session.getActiveUser().getEmail();
    var userName = userEmail.split('@')[0];
    
    var weather = { temp: "24°", location: "São Paulo" };

    var storageUsed = 0;
    try {
      storageUsed = (DriveApp.getStorageUsed() / (1024 * 1024 * 1024)) || 5.2; // fallback para simulação
    } catch(e) {}

    // Emails do Inbox
    var threads = GmailApp.getInboxThreads(0, 10);
    var emails = threads.map(function(t) {
      var msgs = t.getMessages();
      var lastMsg = msgs[msgs.length - 1];
      return {
        id: t.getId(),
        subject: t.getFirstMessageSubject() || "(Sem Assunto)",
        sender: lastMsg.getFrom().split('<')[0].trim(),
        senderInit: lastMsg.getFrom().charAt(0).toUpperCase(),
        time: formatDateSmart(lastMsg.getDate()),
        preview: lastMsg.getPlainBody().substring(0, 80) + "...",
        read: !t.isUnread(),
        hasAttachment: msgs.some(function(m){ return m.getAttachments().length > 0; }),
        messageCount: t.getMessageCount()
      };
    });

    // Arquivos Recentes do Drive
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
        isStarred: f.isStarred()
      });
      count++;
    }

    return JSON.stringify({
      user: { name: userName, email: userEmail, avatar: "https://ui-avatars.com/api/?name=" + userName + "&background=4285F4&color=fff" },
      weather: weather,
      stats: { storageUsed: Math.round((storageUsed / 15) * 100), unreadEmails: GmailApp.getInboxUnreadCount() },
      emails: emails,
      files: files,
      tasks: [],
      notes: []
    });
  } catch(e) {
    return JSON.stringify({ error: e.toString() });
  }
}

// --- HELPERS ---
function formatDateSmart(date) {
  var now = new Date();
  var diff = now.getTime() - date.getTime();
  var days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  if (days === 1) return "Ontem";
  if (days < 7) return date.toLocaleDateString([], {weekday: 'short'});
  return date.toLocaleDateString([], {day: 'numeric', month: 'short'});
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  var k = 1024;
  var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function mapMimeTypeToIcon(mime) {
  if (mime.includes('spreadsheet')) return 'sheet';
  if (mime.includes('presentation')) return 'slide';
  if (mime.includes('document')) return 'doc';
  if (mime.includes('image')) return 'image';
  if (mime.includes('pdf')) return 'pdf';
  return 'file';
}