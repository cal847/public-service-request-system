// Password strength checker - evaluates strength of password.
(function (global) {
  'use strict';

  var RULES = {
    length: { text: '8 or more characters', test: function (p) { return p.length >= 8; } },
    lower:  { text: 'a lowercase letter',   test: function (p) { return /[a-z]/.test(p); } },
    upper:  { text: 'an uppercase letter',  test: function (p) { return /[A-Z]/.test(p); } },
    number: { text: 'a number',             test: function (p) { return /\d/.test(p); } },
    symbol: { text: 'a symbol',             test: function (p) { return /[^A-Za-z0-9]/.test(p); } }
  };

  var LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  var COMMON = [
    'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
    'qwerty123', 'qwertyuiop', 'abc12345', 'iloveyou', 'admin123', 'welcome1',
    'letmein1', 'murangacounty', 'kenya2024', 'kenya2025', 'kenya2026'
  ];

  function isCommon(pw) {
    var lower = pw.toLowerCase();
    return COMMON.indexOf(lower) !== -1 || /^(.)\1+$/.test(pw);
  }

  function evaluate(pw) {
    pw = typeof pw === 'string' ? pw : '';

    var checks = {};
    var passed = 0;
    var missing = [];
    Object.keys(RULES).forEach(function (key) {
      checks[key] = RULES[key].test(pw);
      if (checks[key]) passed++;
      else missing.push(RULES[key].text);
    });

    var acceptable = checks.length && checks.lower && checks.upper && checks.number && !isCommon(pw);

    if (!pw) {
      return { level: 0, label: '', checks: checks, missing: missing, acceptable: false, common: false };
    }

    var common = isCommon(pw);
    var level = Math.max(1, Math.min(4, passed - 1));          // 5 checks -> 4
    if (pw.length >= 12 && passed >= 4) level = Math.min(4, level + 1); // long passphrases
    if (!checks.length || common) level = 1;                    // hard caps

    return {
      level: level,
      label: common ? 'Too common' : LABELS[level],
      checks: checks,
      missing: missing,
      acceptable: acceptable,
      common: common
    };
  }

  function isAcceptable(pw) {
    return evaluate(pw).acceptable;
  }

  function attach(input, ui) {
    function render() {
      var r = evaluate(input.value);

      if (ui.bar) ui.bar.setAttribute('data-level', String(r.level));

      if (ui.rules) {
        Object.keys(r.checks).forEach(function (key) {
          var li = ui.rules.querySelector('[data-rule="' + key + '"]');
          if (li) li.classList.toggle('met', r.checks[key]);
        });
      }

      if (ui.label) {
        if (!input.value) {
          ui.label.textContent = 'Enter a password';
        } else if (r.common) {
          ui.label.textContent = 'Too common. Choose something harder to guess.';
        } else if (!r.acceptable) {
          var needed = [];
          ['length', 'lower', 'upper', 'number'].forEach(function (k) {
            if (!r.checks[k]) needed.push(RULES[k].text);
          });
          ui.label.textContent = r.label + '. Add ' + needed.join(', ') + '.';
        } else {
          ui.label.textContent = r.label + (r.level < 4 ? '. Add a symbol or make it longer to strengthen it.' : '.');
        }
      }
      return r;
    }

    input.addEventListener('input', render);
    render();
    return render;
  }

  global.PasswordStrength = { evaluate: evaluate, isAcceptable: isAcceptable, attach: attach };
})(window);