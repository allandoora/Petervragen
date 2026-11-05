'use strict';

/* ==========================================================
   Instellingen
   ========================================================== */
const EDGE = 16;           // minimale afstand tot de rand van het scherm (px)
const GRID_STEP = 20;      // fijnheid waarmee we naar vrije plekken zoeken (px)
const TEXT_GAP = 24;       // vrije ruimte rond tekst en Ja-knop (px)
const MIN_DISTANCE = 220;  // hoe ver de Nee-knop minstens van de muis landt (px)

const CONFETTI_COUNT = 180;
const CONFETTI_COLORS = ['#3ee0b0', '#f4f9ff', '#ff7a45', '#ffd166', '#6ec6ff'];


/* ==========================================================
   Elementen
   ========================================================== */
const jaButton    = document.getElementById('btn-ja');
const neeButton   = document.getElementById('btn-nee');
const neeSlot     = document.getElementById('nee-slot');
const terugButton = document.getElementById('btn-terug');

const title    = document.querySelector('#view-ask h1');
const subtitle = document.querySelector('#view-ask p');

const canvas = document.getElementById('confetti');
const ctx    = canvas.getContext('2d');


/* ==========================================================
   De Nee-knop laten ontwijken
   ========================================================== */
let neeIsLoose = false;
const pointer = { x: -1000, y: -1000 };

/* Haalt de Nee-knop uit de normale opmaak, zodat hij vrij kan bewegen.
   Het vakje blijft even groot, zodat de rest van de pagina niet verschuift. */
function detachNeeButton() {
  if (neeIsLoose) return;

  const rect = neeButton.getBoundingClientRect();

  neeSlot.style.width = rect.width + 'px';
  neeSlot.style.height = rect.height + 'px';

  neeButton.classList.add('is-loose');
  neeButton.style.left = rect.left + 'px';
  neeButton.style.top = rect.top + 'px';

  neeIsLoose = true;
  void neeButton.offsetWidth; // forceer een herberekening, zodat de eerste sprong animeert
}

/* Zet de Nee-knop terug op zijn oorspronkelijke plek in de opmaak. */
function resetNeeButton() {
  neeButton.classList.remove('is-loose');
  neeButton.style.left = '';
  neeButton.style.top = '';
  neeSlot.style.width = '';
  neeSlot.style.height = '';
  neeIsLoose = false;
}

/* Raken twee rechthoeken elkaar (met een extra marge)? */
function rectsOverlap(a, b, gap) {
  return !(
    a.right + gap < b.left ||
    a.left - gap > b.right ||
    a.bottom + gap < b.top ||
    a.top - gap > b.bottom
  );
}

/* Alles waar de Nee-knop nooit overheen mag: titel, ondertitel en Ja-knop. */
function getObstacles() {
  return [title, subtitle, jaButton].map((el) => el.getBoundingClientRect());
}

function distanceToPointer(box) {
  const centerX = (box.left + box.right) / 2;
  const centerY = (box.top + box.bottom) / 2;
  return Math.hypot(centerX - pointer.x, centerY - pointer.y);
}

/* Zoekt een plek voor de Nee-knop die:
   1. binnen het scherm ligt,
   2. nergens de tekst of de Ja-knop raakt,
   3. liefst ver van de muis ligt.
   We overlopen het scherm in een raster en kiezen willekeurig uit de goede plekken. */
function findFreeSpot() {
  const width = neeButton.offsetWidth;
  const height = neeButton.offsetHeight;
  const obstacles = getObstacles();
  const minDistance = Math.min(MIN_DISTANCE, window.innerWidth / 2);

  // Eerst met marge rond de tekst. Past dat niet (heel klein scherm), dan zonder marge.
  for (const gap of [TEXT_GAP, 0]) {
    const freeSpots = [];

    for (let y = EDGE; y <= window.innerHeight - height - EDGE; y += GRID_STEP) {
      for (let x = EDGE; x <= window.innerWidth - width - EDGE; x += GRID_STEP) {
        const box = { left: x, top: y, right: x + width, bottom: y + height };
        const touchesObstacle = obstacles.some((o) => rectsOverlap(box, o, gap));

        if (!touchesObstacle) {
          freeSpots.push({ x, y, distance: distanceToPointer(box) });
        }
      }
    }

    if (freeSpots.length === 0) continue;

    // Kies willekeurig uit de plekken die ver genoeg van de muis liggen
    const farSpots = freeSpots.filter((spot) => spot.distance >= minDistance);
    if (farSpots.length > 0) {
      return farSpots[Math.floor(Math.random() * farSpots.length)];
    }

    // Geen enkele plek ver genoeg? Neem dan de verste.
    return freeSpots.reduce((best, spot) => (spot.distance > best.distance ? spot : best));
  }

  return { x: EDGE, y: EDGE };
}

function dodge(event) {
  if (event && event.cancelable) event.preventDefault();

  detachNeeButton();

  // Onthoud waar de muis of vinger is
  const point = event && event.touches ? event.touches[0] : event;
  if (point && point.clientX !== undefined) {
    pointer.x = point.clientX;
    pointer.y = point.clientY;
  }

  const spot = findFreeSpot();
  neeButton.style.left = spot.x + 'px';
  neeButton.style.top = spot.y + 'px';
}

// Springt weg zodra je er op welke manier ook aan komt
neeButton.addEventListener('pointerenter', dodge);
neeButton.addEventListener('pointerdown', dodge);
neeButton.addEventListener('touchstart', dodge, { passive: false });
neeButton.addEventListener('focus', dodge);
neeButton.addEventListener('click', dodge);

// Springt ook al weg als de muis dichtbij komt
document.addEventListener('pointermove', (event) => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;

  if (!neeIsLoose) return;

  const rect = neeButton.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const triggerDistance = Math.max(rect.width, rect.height) * 0.9;

  if (Math.hypot(event.clientX - centerX, event.clientY - centerY) < triggerDistance) {
    dodge(event);
  }
});

// Bij een ander schermformaat zoeken we een nieuwe, geldige plek
window.addEventListener('resize', () => {
  if (neeIsLoose) dodge();
});


/* ==========================================================
   Confetti
   ========================================================== */
let confettiPieces = [];
let confettiFrame = 0;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function startConfetti() {
  confettiPieces = [];

  for (let i = 0; i < CONFETTI_COUNT; i++) {
    confettiPieces.push({
      x: canvas.width / 2,
      y: canvas.height * 0.55,
      vx: (Math.random() - 0.5) * 18,
      vy: -Math.random() * 18 - 4,
      size: 6 + Math.random() * 8,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotation: Math.random() * 6,
      spin: (Math.random() - 0.5) * 0.4,
    });
  }

  cancelAnimationFrame(confettiFrame);
  animateConfetti();
}

function animateConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const piece of confettiPieces) {
    piece.vy += 0.45;      // zwaartekracht
    piece.vx *= 0.992;     // luchtweerstand
    piece.x += piece.vx;
    piece.y += piece.vy;
    piece.rotation += piece.spin;

    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.rotation);
    ctx.fillStyle = piece.color;
    ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
    ctx.restore();
  }

  // Stukjes die uit beeld vallen, verwijderen we
  confettiPieces = confettiPieces.filter((p) => p.y < canvas.height + 20);

  if (confettiPieces.length > 0) {
    confettiFrame = requestAnimationFrame(animateConfetti);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);


/* ==========================================================
   Schermen wisselen
   De adresbalk bepaalt welk scherm je ziet: "#ja" toont het tweede scherm.
   ========================================================== */
function showCurrentView() {
  const isJa = location.hash === '#ja';

  // Bij elke schermwissel start de Nee-knop weer op zijn eigen plek
  resetNeeButton();

  document.body.classList.toggle('is-ja', isJa);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (isJa && !prefersReducedMotion) startConfetti();
}

// Het adres verandert naar "#ja", daarna roept "hashchange" showCurrentView aan
jaButton.addEventListener('click', () => {
  location.hash = 'ja';
});

terugButton.addEventListener('click', () => {
  history.replaceState(null, '', location.pathname + location.search);
  showCurrentView();
});

// Terugknop of vooruitknop van de browser
window.addEventListener('hashchange', showCurrentView);

// Browsers bewaren soms een pagina met alle toestand erbij en tonen
// die opnieuw bij "terug". In dat geval laden we de pagina als nieuw in.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) showCurrentView();
});

showCurrentView();