// Reloads the page, which checks the session again as every page load does
// (features/24_ui_states question 2; features/04_session_persistence). A module of its own,
// so a test can replace it: jsdom cannot reload a page.
export function reloadPage(): void {
  window.location.reload()
}
