// Handles login and registration 
(function () {
  'use strict';

  var RE = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    phone: /^(?:\+254|254|0)[17]\d{8}$/,
    id: /^\d{7,8}$/,
    name: /^\p{L}[\p{L}\s'.-]{1,79}$/u
  };

  var alertBox = document.getElementById('formAlert');

  /* ---- helpers ---- */
  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  function setFieldError(form, name, message) {
    var out = form.querySelector('[data-error-for="' + name + '"]');
    var input = form.elements[name];
    if (out) out.textContent = message || '';
    if (input) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function clearErrors(form) {
    Array.prototype.forEach.call(form.elements, function (el) {
      if (el.name) setFieldError(form, el.name, '');
    });
    alertBox.hidden = true;
    alertBox.textContent = '';
  }

  function showAlert(message) {
    alertBox.textContent = message;
    alertBox.hidden = false;
    alertBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function showErrors(form, errors) {
    var first = null;
    Object.keys(errors).forEach(function (name) {
      setFieldError(form, name, errors[name]);
      if (!first && form.elements[name]) first = form.elements[name];
    });
    if (first) first.focus();
  }

  function setBusy(button, busy, idleText, busyText) {
    button.disabled = busy;
    button.textContent = busy ? busyText : idleText;
  }

  // Show/hide password
  document.querySelectorAll('.toggle-pass').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.getAttribute('data-target'));
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-pressed', String(show));
    });
  });

  // Page redirection for sign in users
  fetch('/api/auth/me', { credentials: 'same-origin' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) { if (data && data.redirect) location.replace(data.redirect); })
    .catch(function () { /* not signed in, stay on the page */ });

  // Login
  var loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(loginForm);

      var identifier = loginForm.elements.identifier.value.trim();
      var password = loginForm.elements.password.value;
      var errors = {};
      if (!identifier) errors.identifier = 'Enter your email or phone number.';
      if (!password) errors.password = 'Enter your password.';
      if (Object.keys(errors).length) return showErrors(loginForm, errors);

      var btn = document.getElementById('submitBtn');
      setBusy(btn, true, 'Sign In', 'Signing in…');

      post('/api/auth/login', { identifier: identifier, password: password })
        .then(function (r) {
          if (r.ok) return location.assign(r.data.redirect);
          showAlert(r.data.error || 'Could not sign in. Please try again.');
          setBusy(btn, false, 'Sign In');
        })
        .catch(function () {
          showAlert('Cannot reach the server. Check your connection and try again.');
          setBusy(btn, false, 'Sign In');
        });
    });
  }

  // Registration
  var registerForm = document.getElementById('registerForm');
  if (registerForm) {
    PasswordStrength.attach(registerForm.elements.password, {
      bar: document.getElementById('strengthBar'),
      label: document.getElementById('strengthLabel'),
      rules: document.getElementById('strengthRules')
    });

    registerForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(registerForm);

      var f = registerForm.elements;
      var values = {
        name: f.name.value.trim().replace(/\s+/g, ' '),
        email: f.email.value.trim(),
        phone: f.phone.value.trim(),
        idNumber: f.idNumber.value.trim(),
        password: f.password.value
      };

      var errors = {};
      if (!RE.name.test(values.name)) errors.name = 'Enter your full name (letters only).';
      if (!RE.email.test(values.email)) errors.email = 'Enter a valid email address.';
      if (!RE.phone.test(values.phone.replace(/[\s\-()]/g, ''))) {
        errors.phone = 'Enter a valid Kenyan number, e.g. 0712 345 678.';
      }
      if (!RE.id.test(values.idNumber)) errors.idNumber = 'ID number must be 7 or 8 digits.';
      if (!PasswordStrength.isAcceptable(values.password)) {
        errors.password = 'Choose a stronger password. See the checklist below.';
      }
      if (Object.keys(errors).length) return showErrors(registerForm, errors);

      var btn = document.getElementById('submitBtn');
      setBusy(btn, true, 'Create Account', 'Creating account…');

      post('/api/auth/register', values)
        .then(function (r) {
          if (r.ok) return location.assign(r.data.redirect);
          if (r.data.errors) showErrors(registerForm, r.data.errors);
          else showAlert(r.data.error || 'Could not create your account. Please try again.');
          setBusy(btn, false, 'Create Account');
        })
        .catch(function () {
          showAlert('Cannot reach the server. Check your connection and try again.');
          setBusy(btn, false, 'Create Account');
        });
    });
  }
})();