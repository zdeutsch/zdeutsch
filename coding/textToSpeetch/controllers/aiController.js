const axios = require('axios');

exports.aiNotes = async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured.' });
    const { prompt, selectedText } = req.body || {};
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Prompt is required.' });
    const composed = `${prompt}`; // prompt already includes any context
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: composed }],
      temperature: 0.3,
      max_tokens: 400
    }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
    const content = response.data?.choices?.[0]?.message?.content || '';
    res.json({ note: (content || '').trim() });
  } catch (error) {
    console.error('AI notes error:', error?.response?.data || error.message);
    const msg = error?.response?.data?.error?.message || error.message || 'Failed to contact AI.';
    res.status(500).json({ error: msg });
  }
};

// Transcribe audio (base64) using OpenAI Whisper
exports.aiTranscribe = async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured.' });
    const { audioBase64, mime = 'audio/webm', filename = 'audio.webm', language } = req.body || {};
    if (!audioBase64 || typeof audioBase64 !== 'string') return res.status(400).json({ error: 'audioBase64 is required.' });
    const base64 = audioBase64.includes(',') ? audioBase64.split(',').pop() : audioBase64;
    const audioBuffer = Buffer.from(base64, 'base64');

    const boundary = '--------------------------' + Math.random().toString(16).slice(2);
    const CRLF = '\r\n';
    const chunks = [];
    const push = (s) => chunks.push(Buffer.isBuffer(s) ? s : Buffer.from(s));
    // model
    push(`--${boundary}${CRLF}`);
    push(`Content-Disposition: form-data; name="model"${CRLF}${CRLF}`);
    push('whisper-1');
    push(CRLF);
    // language (optional)
    if (language) {
      push(`--${boundary}${CRLF}`);
      push(`Content-Disposition: form-data; name="language"${CRLF}${CRLF}`);
      push(String(language));
      push(CRLF);
    }
    // file
    push(`--${boundary}${CRLF}`);
    push(`Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}`);
    push(`Content-Type: ${mime}${CRLF}${CRLF}`);
    push(audioBuffer);
    push(CRLF);
    push(`--${boundary}--${CRLF}`);
    const body = Buffer.concat(chunks);

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', body, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    const text = (response.data && (response.data.text || response.data.text === '' ? response.data.text : response.data)) || '';
    res.json({ text: String(text || '').trim() });
  } catch (err) {
    console.error('AI transcribe error:', err?.response?.data || err.message);
    const msg = err?.response?.data?.error?.message || err.message || 'Failed to transcribe audio.';
    res.status(500).json({ error: msg });
  }
};
