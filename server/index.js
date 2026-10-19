const path = require('path');
const express = require('express');
const session = require('express-session');

require('./db');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.SESSION_SECRET) {
  throw new Error('Set SESSION_SECRET before running in production.');
}

app.use(express.json({ limit: '10kb' }));

app.use(
  session({
    name: 'connect.sid',
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

app.use('/api/auth', authRoutes);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));