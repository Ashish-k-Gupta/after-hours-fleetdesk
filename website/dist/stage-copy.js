// The three operational chapters share one state with the miniature and HUD.
export const stageFor = state => Math.min(3, state.phase);
export const STAGE_COPY = [
  {title: '00 / THE YARD', message: 'Truck ready. A new load ahead.'},
  {title: '01 / AT THE DOCK', message: 'Arrived on time. 6 pallets loaded. Detention timer armed.'},
  {title: '02 / IN TRANSIT', message: 'Location checked. ETA followed up. Customer informed.'},
  {title: '03 / DELIVERED', message: 'Empty on time. Clean POD verified. Sent to broker.'},
];

export function telemetryFor(state) {
  const stage = stageFor(state);
  if (stage === 0) return {pallets: '0 / 6 PALLETS', document: 'AWAITING PICKUP', percent: ''};
  if (stage === 1) return {pallets: state.cargo + ' / 6 PALLETS', document: 'DETENTION LOGGED', percent: ''};
  if (stage === 2) return {pallets: '6 / 6 PALLETS', document: 'BOL CONFIRMED', percent: '68%'};
  return {pallets: state.cargo + ' / 6 PALLETS', document: state.pod ? 'CLEAN POD SENT' : 'POD FOLLOW-UP', percent: state.pod ? '100%' : Math.round(68 + state.unloadProgress * 28) + '%'};
}

export function calloutFor(state) {
  const stage = stageFor(state);
  if (stage === 1 && state.cargo < 6) return {title: STAGE_COPY[stage].title, message: 'Arrived on time. ' + state.cargo + ' / 6 pallets loaded. Detention timer armed.'};
  if (stage === 3 && !state.pod) return {title: '03 / AT THE RECEIVER', message: state.cargo ? 'At the dock. Unload followed. Paperwork requested.' : 'Empty on time. Following up on the clean POD.'};
  return STAGE_COPY[stage];
}
