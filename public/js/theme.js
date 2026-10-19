(function () {
  'use strict';

  var KEY = 'mcps-theme';
  var root = document.documentElement;
  var button = document.getElementById('themeToggle');
  if (!button) return;

  var icon = button.querySelector('.material-symbols-outlined');

  function apply(theme) {
    var dark = theme === 'dark';
    if (dark) root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    if (icon) icon.textContent = dark ? 'light_mode' : 'dark_mode';
  }

  apply(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  button.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem(KEY, next); } catch (err) {}
  });

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (event) {
      var saved = null;
      try { saved = localStorage.getItem(KEY); } catch (err) {}
      if (!saved) apply(event.matches ? 'dark' : 'light');
    });
  }
})();
