const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('client/build'));
}

// Neon DB connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Connected to Neon PostgreSQL database');
  release();
});

// WebSocket connection handling
wss.on('connection', function connection(ws) {
  console.log('WebSocket client connected');
  
  ws.on('close', function() {
    console.log('WebSocket client disconnected');
  });
});

// Helper function to broadcast messages to all WebSocket clients
function broadcastMessage(type, data) {
  const message = JSON.stringify({ type, data });
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// API Routes (your existing routes here)
app.get('/api/customers', async (req, res) => {
  // ... your existing route implementation
});

// ... all your other API routes ...

// For React Router - handle all other routes and return the React app
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
