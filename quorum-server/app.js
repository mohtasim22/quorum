const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const userRoutes = require('./routes/userRoutes');
const questionRoutes = require('./routes/questionRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});


app.use('/api/users', userRoutes);
app.use('/api/questions', questionRoutes);


app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});


app.use(errorHandler);

module.exports = app;
