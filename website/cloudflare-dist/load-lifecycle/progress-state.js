// Geometry is viewport-relative so fonts and resizes stay in sync.
function readingLines(headerHeight, viewportHeight) {
  const available = Math.max(1, viewportHeight - headerHeight);
  const initial = headerHeight + Math.min(140, available * .24);
  return {available, initial, movement: Math.max(0, viewportHeight - 100 - initial)};
}

export function stageScrollTarget({top, headerHeight, viewportHeight, maximumScroll}) {
  const {initial, movement} = readingLines(headerHeight, viewportHeight);
  if (maximumScroll <= 0) return 0;
  return Math.max(0, Math.min(maximumScroll, (top - initial + 2) / (1 + movement / maximumScroll)));
}

export function readingProgress({stages, headerHeight, viewportHeight, atEnd, scrollFraction = 0}) {
  const {available, initial, movement} = readingLines(headerHeight, viewportHeight);
  const fraction = Math.max(0, Math.min(1, scrollFraction));
  // On a concise page the reading position moves lower as the page approaches its end.
  const activationLine = initial + movement * fraction;
  const readingLine = headerHeight + available * .62;
  let active = 0;
  stages.forEach((stage, index) => {if (stage.top <= activationLine) active = index;});
  if (atEnd) active = stages.length - 1;
  const finished = active === stages.length - 1 && (stages.at(-1).bottom <= readingLine || atEnd);
  const completed = finished ? stages.length : active;
  return {active, completed};
}
