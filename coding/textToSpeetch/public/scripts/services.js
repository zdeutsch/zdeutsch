// Simple services layer for API calls
// Exposes a global `Services` object for use across pages.
// No build step required.

(function () {
  const parseResponse = async (response) => {
    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch (_) { payload = null; }
    }
    if (!response.ok) {
      const message = (payload && payload.error) || response.statusText || 'Request failed';
      const err = new Error(message);
      err.status = response.status;
      throw err;
    }
    return payload;
  };

  const apiRequest = async (url, options = {}) => {
    const res = await fetch(url, options);
    return parseResponse(res);
  };

  // ---- Audio services ----
  const textToSpeech = (body) => apiRequest('/api/text_insight/text-to-speech', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const getAudios = (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/api/text_insight${qs ? `?${qs}` : ''}`);
  };
  const deleteAudio = (filePath) => apiRequest(`/api/text_insight?filePath=${encodeURIComponent(filePath)}`, { method: 'DELETE' });
  const renameAudio = (filePath, title) => apiRequest('/api/text_insight', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath, title })
  });
  const moveAudio = (filePath, targetFolder) => apiRequest('/api/text_insight/move', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath, targetFolder })
  });
  const listAudioFiles = () => apiRequest('/api/text_insight/files');
  const generateTimestamps = (filePath) => apiRequest('/api/text_insight/generate-timestamps', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath })
  });

  // ---- Folder services ----
  const getFolders = () => apiRequest('/api/folders');
  const createFolder = (folder) => apiRequest('/api/folders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder })
  });
  const moveFolder = (from, to) => apiRequest('/api/folders/move', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to })
  });
  const deleteFolder = (folder) => apiRequest(`/api/folders?folder=${encodeURIComponent(folder)}`, { method: 'DELETE' });

  // ---- Notes services ----
  const getNotes = (filePath) => apiRequest(`/api/notes?filePath=${encodeURIComponent(filePath)}`);
  const createNote = (payload) => apiRequest('/api/notes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const updateNote = (id, payload) => apiRequest(`/api/notes/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  const deleteNote = (id) => apiRequest(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });

  // ---- AI services ----
  const aiNotes = (prompt, selectedText = '') => apiRequest('/api/ai-notes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, selectedText })
  });

  window.Services = {
    apiRequest,
    // audio
    textToSpeech, getAudios, deleteAudio, renameAudio, moveAudio, listAudioFiles, generateTimestamps,
    // folders
    getFolders, createFolder, moveFolder, deleteFolder,
    // notes
    getNotes, createNote, updateNote, deleteNote,
    // ai
    aiNotes,
  };
})();
