/* global document, localStorage, window */
(function initialiseTheme() {
  var theme = localStorage.getItem('gx-theme');
  if (!theme) {
    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', theme);
}());
