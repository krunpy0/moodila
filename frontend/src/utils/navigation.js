export function safeNavigateBack(navigate, fallbackPath = "/home") {
  const hasHistory =
    (window.history.state &&
      typeof window.history.state.idx === "number" &&
      window.history.state.idx > 0) ||
    window.history.length > 1;

  if (hasHistory) {
    navigate(-1);
  } else {
    navigate(fallbackPath, { replace: true });
  }
}
