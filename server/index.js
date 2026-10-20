const path = require('path');
const express = require('express');
const session = require('express-session');

require('./db');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const serviceRequestRoutes = require('./routes/service-requests');

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
app.use('/api/admin', adminRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    index: false,
    setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff'),
  })
);

// Send admins to their dashboard instead of the public homepage.
app.get('/', (req, res) => {
  if (req.session.user?.role === 'admin') {
    return res.redirect('/admin.html');
  }

  res.redirect('/index.html');
});

// Non-admins get redirected to index.html
app.get('/index.html', (req, res, next) => {
  if (req.session.user?.role === 'admin') {
    return res.redirect('/admin.html');
  }

  next();
});
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));