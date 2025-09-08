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
const WS_PORT = process.env.WS_PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

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

// Routes

// Customers routes
app.get('/api/customers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, email, phone, company, status, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO customers (name, email, phone, company, status, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, email, phone, company, status, notes]
    );
    
    // Broadcast new customer event
    broadcastMessage('NEW_CUSTOMER', result.rows[0]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, company, status, notes } = req.body;
    const result = await pool.query(
      'UPDATE customers SET name = $1, email = $2, phone = $3, company = $4, status = $5, notes = $6 WHERE id = $7 RETURNING *',
      [name, email, phone, company, status, notes, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Broadcast customer updated event
    broadcastMessage('CUSTOMER_UPDATED', result.rows[0]);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Tickets routes
app.get('/api/tickets', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, c.name as customer_name, u.name as agent_name 
      FROM tickets t 
      LEFT JOIN customers c ON t.customer_id = c.id 
      LEFT JOIN users u ON t.assigned_to = u.id 
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT t.*, c.name as customer_name, u.name as agent_name 
      FROM tickets t 
      LEFT JOIN customers c ON t.customer_id = c.id 
      LEFT JOIN users u ON t.assigned_to = u.id 
      WHERE t.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/tickets', async (req, res) => {
  try {
    const { title, description, customer_id, status, priority, assigned_to } = req.body;
    const result = await pool.query(
      'INSERT INTO tickets (title, description, customer_id, status, priority, assigned_to) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, description, customer_id, status, priority, assigned_to]
    );
    
    // Broadcast new ticket event
    broadcastMessage('NEW_TICKET', result.rows[0]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, customer_id, status, priority, assigned_to } = req.body;
    const result = await pool.query(
      'UPDATE tickets SET title = $1, description = $2, customer_id = $3, status = $4, priority = $5, assigned_to = $6 WHERE id = $7 RETURNING *',
      [title, description, customer_id, status, priority, assigned_to, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    // Broadcast ticket updated event
    broadcastMessage('TICKET_UPDATED', result.rows[0]);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM tickets WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json({ message: 'Ticket deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ticket comments routes
app.get('/api/tickets/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT c.*, u.name as author_name 
      FROM comments c 
      LEFT JOIN users u ON c.author_id = u.id 
      WHERE c.ticket_id = $1 
      ORDER BY c.created_at DESC
    `, [id]);
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/tickets/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, author_id } = req.body;
    const result = await pool.query(
      'INSERT INTO comments (content, author_id, ticket_id) VALUES ($1, $2, $3) RETURNING *',
      [content, author_id, id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Users routes
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, email, role, status } = req.body;
    const result = await pool.query(
      'INSERT INTO users (name, email, role, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, role, status]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, status } = req.body;
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, role = $3, status = $4 WHERE id = $5 RETURNING *',
      [name, email, role, status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Teams routes
app.get('/api/teams', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teams ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/teams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM teams WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/teams', async (req, res) => {
  try {
    const { name, description, members } = req.body;
    const result = await pool.query(
      'INSERT INTO teams (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    
    // Add team members if provided
    if (members && members.length > 0) {
      for (const memberId of members) {
        await pool.query(
          'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)',
          [result.rows[0].id, memberId]
        );
      }
    }
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/teams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, members } = req.body;
    
    // Update team details
    const result = await pool.query(
      'UPDATE teams SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Update team members
    if (members) {
      // Remove existing members
      await pool.query('DELETE FROM team_members WHERE team_id = $1', [id]);
      
      // Add new members
      if (members.length > 0) {
        for (const memberId of members) {
          await pool.query(
            'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)',
            [id, memberId]
          );
        }
      }
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/teams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First delete team members
    await pool.query('DELETE FROM team_members WHERE team_id = $1', [id]);
    
    // Then delete the team
    const result = await pool.query('DELETE FROM teams WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    res.json({ message: 'Team deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start servers
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

server.listen(WS_PORT, () => {
  console.log(`WebSocket server running on port ${WS_PORT}`);
});