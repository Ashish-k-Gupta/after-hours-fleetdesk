import {readingProgress, stageScrollTarget} from './progress-state.js';

const links = [...document.querySelectorAll('[data-progress-step]')];
const sections = links.map(link => document.querySelector(link.getAttribute('href')));
const stages = document.querySelector('[data-progress-stages]');
const sidebar = document.querySelector('.load-progress');
const story = document.querySelector('.story');
const content = document.querySelector('.lifecycle-content');
const visual = document.querySelector('[data-progress-visual]');
const preview = document.querySelector('[data-progress-preview]');
const animationToggle = document.querySelector('[data-animation-toggle]');
const animationReplay = document.querySelector('[data-animation-replay]');
let selected = -1, lastCompleted = -1, miniature = null, raf = 0, pageHidden = false, miniGeneration = 0;
let restoring = true;
const setText = (element, value) => {if (element.textContent !== value) element.textContent = value;};
document.documentElement.classList.add('progress-restoring');

function revealCurrent() {
  const bounds = sidebar.getBoundingClientRect();
  const current = links[selected].getBoundingClientRect();
  if (current.top < bounds.top + 6) sidebar.scrollTop -= bounds.top + 6 - current.top;
  else if (current.bottom > bounds.bottom - 28) sidebar.scrollTop += current.bottom - bounds.bottom + 28;
}

function update() {
  raf = 0;
  const state = readingProgress({
    stages: sections.map(section => section.getBoundingClientRect()),
    headerHeight: document.querySelector('.page-header').getBoundingClientRect().height,
    viewportHeight: innerHeight,
    atEnd: scrollY + innerHeight >= document.documentElement.scrollHeight - 4,
    scrollFraction: scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)
  });
  const changed = state.active !== selected;
  const completionChanged = state.completed !== lastCompleted;
  selected = state.active;
  if (changed || completionChanged) {
    const label = links[selected].querySelector('.stage-label').textContent;
    links.forEach((link, index) => {
      const complete = index < state.completed;
      link.parentElement.classList.toggle('is-current', index === selected);
      link.parentElement.classList.toggle('is-complete', complete);
      sections[index].classList.toggle('is-current', index === selected);
      sections[index].classList.toggle('is-complete', complete);
      if (index === selected) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
      setText(link.querySelector('[data-stage-state]'), complete ? 'Completed stage' : index === selected ? 'Current stage' : 'Upcoming stage');
    });
    stages.style.setProperty('--progress', `${selected / (links.length - 1) * 100}%`);
    setText(document.querySelector('[data-progress-count]'), `${state.completed} of ${links.length} complete`);
    setText(document.querySelector('[data-progress-compact]'), `${state.completed}/${links.length}`);
    setText(document.querySelector('[data-progress-title]'), label);
    setText(document.querySelector('[data-progress-announcement]'), `${label}. Stage ${selected + 1} of ${links.length}. ${state.completed} stages complete in this walkthrough.`);
    if (changed) miniature?.setStage(selected, label);
    lastCompleted = state.completed;
    revealCurrent();
  }
  if (restoring) {
    restoring = false;
    requestAnimationFrame(() => document.documentElement.classList.remove('progress-restoring'));
  }
}

function schedule() {
  if (!raf && !pageHidden) raf = requestAnimationFrame(update);
}

function navigateToStage(index, smooth = true) {
  const top = stageScrollTarget({
    top: sections[index].getBoundingClientRect().top + scrollY,
    headerHeight: document.querySelector('.page-header').getBoundingClientRect().height,
    viewportHeight: innerHeight,
    maximumScroll: document.documentElement.scrollHeight - innerHeight
  });
  scrollTo({top, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant'});
  if (index === selected && smooth) miniature?.replay();
  schedule();
}

links.forEach((link, index) => link.addEventListener('click', event => {
  event.preventDefault();
  history.replaceState(null, '', link.getAttribute('href'));
  navigateToStage(index);
}));

function restoreHashStage() {
  const index = links.findIndex(link => link.getAttribute('href') === location.hash);
  if (index >= 0) navigateToStage(index, false);
  else schedule();
}

function removeMiniature() {
  miniGeneration++;
  miniature?.dispose();
  miniature = null;
  visual.hidden = true;
  preview.classList.remove('has-miniature');
  story.classList.remove('has-scene');
  schedule();
}

async function initMiniature() {
  if (miniature || pageHidden) return;
  const generation = ++miniGeneration;
  try {
    const {mountProgressScene} = await import('./progress-scene.js');
    if (generation !== miniGeneration || pageHidden) return;
    visual.hidden = false;
    preview.classList.add('has-miniature');
    story.classList.add('has-scene');
    miniature = mountProgressScene(document.querySelector('[data-mini-scene]'), removeMiniature, {
      onPlaybackChange: ({playing}) => {
        animationToggle.textContent = playing ? 'Pause' : 'Play';
        animationToggle.setAttribute('aria-label', playing ? 'Pause stage animation' : 'Play stage animation');
      }
    });
    const index = Math.max(0, selected);
    miniature.setStage(index, links[index].querySelector('.stage-label').textContent);
    schedule();
  } catch {
    removeMiniature();
  }
}

const observer = new ResizeObserver(schedule);
animationToggle.addEventListener('click', () => miniature?.togglePlayback());
animationReplay.addEventListener('click', () => miniature?.replay());
observer.observe(content);
observer.observe(story);
document.addEventListener('scroll', schedule, {passive: true});
addEventListener('resize', schedule, {passive: true});
addEventListener('hashchange', restoreHashStage);
document.fonts.ready.then(restoreHashStage);
document.addEventListener('visibilitychange', () => {if (!document.hidden) schedule();});
addEventListener('pagehide', () => {
  pageHidden = true;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  observer.disconnect();
  removeMiniature();
});
addEventListener('pageshow', event => {
  pageHidden = false;
  if (event.persisted) {
    restoring = true;
    document.documentElement.classList.add('progress-restoring');
    observer.observe(content);
    observer.observe(story);
    selected = -1;
  }
  schedule();
  void initMiniature();
});
schedule();
void initMiniature();
