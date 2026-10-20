/**
 * eEntry point for the server. Sets up the database, runs seed-data.js 
 * and defines routes
 */
const path = require('path');
const express = require('express');
const session = require('express-session');

require('./db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const serviceRequestRoutes = require('./routes/service-requests');
const { requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

const HOME_PAGE = '/html/index.html';

// Run seed data
if (process.env.SEED_DEMO === 'true') {
  try {
    require('./seed-data').seedDemo();
  } catch (err) {
    console.error('Demo seeding failed:', err);
  }
}

if (isProd && !process.env.SESSION_SECRET) {
  throw new Error('Set SESSION_SECRET before running in production.');
}

if (isProd) app.set('trust proxy', 1);

// Health check
app.get('/healthz', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.status(200).type('text').send('ok');
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(503).type('text').send('database error');
  }
});

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
app.use('/api/admin', adminRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use(
  '/uploads',
  requireAdmin,
  express.static(path.join(__dirname, 'uploads'), {
    index: false,
    setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
  })
);

app.get('/index.html', (req, res) => {
  if (req.session.user?.role === 'admin') {
    return res.redirect('/html/admin.html');
  }

  res.redirect(HOME_PAGE); // /html/index.html
});

app.get(HOME_PAGE, (req, res, next) => {
  if (req.session.user?.role === 'admin') {
    return res.redirect('/html/admin.html');
  }

  next(); 
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));