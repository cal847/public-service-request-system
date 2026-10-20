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

// Admins load admin page, everyone else is redirected to home page
app.get('/admin.html', (req, res, next) => {
    const user = req.session.user;
    if (!user) return res.redirect('/login.html');
    if (user.role !== 'admin') return res.redirect('../html/index.html')
})
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));