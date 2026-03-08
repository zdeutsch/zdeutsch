// Text Insight server (modularized with routers/controllers)
require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { audioDir, ensureDir } = require('./utils/common');

// Routers
const audioRoutes = require('./routes/audioRoutes');
const folderRoutes = require('./routes/folderRoutes');
const notesRoutes = require('./routes/notesRoutes');
const aiRoutes = require('./routes/aiRoutes');
const textInsightRoutes = require('./routes/textInsightRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure storage paths are present
ensureDir(audioDir);

// Middleware & static hosting
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(audioDir));

// API routes (mounted under /api)
app.use('/api', audioRoutes);
app.use('/api', folderRoutes);
app.use('/api', notesRoutes);
app.use('/api', aiRoutes);
app.use('/api', textInsightRoutes);

// Web routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'menu.html'));
});
app.get('/text-insight', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'text-insight.html'));
});
app.get('/text-insight-vue', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Socket.IO (for OBS control broadcasting etc.)
const server = http.createServer(app);
const io = new Server(server);
io.on('connection', (socket) => {
  socket.on('control', (data) => io.emit('obs-control', data));
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
