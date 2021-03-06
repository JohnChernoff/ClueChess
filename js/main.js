//TODO: give hints (missing square highlighted, etc.)
const PIECE_CHRS = "kqrbnp-PNBRQK";
let current_fen_idx;
let fens;
let puzzle;
let solution_board;
let missing = 3;
let time_thread = null;
let playing = false;
let player_name = "anon";
let animation_start;
let animation_time = 2000;
let default_solve_time = 180;
let solve_time, score; //let base_bonus = 60;
let win_sounds = new Array(8);
let tracks = new Array(4);
let current_track = 0;
let music = false;
let seed;
let rnd_fun;
let help_screen = document.getElementById("modal-help-overlay");
let about_screen = document.getElementById("modal-about-overlay");
let splash_screen = document.getElementById("splash");
let splash_continue_msg = document.getElementById("txt_continue");
let txt_time = document.getElementById("text-time");
let txt_score = document.getElementById("text-score");
let chk_verbose = document.getElementById("chk-verbose");
let range_missing = document.getElementById("range-missing");
range_missing.oninput = function() {
  let value = (this.value-this.min) / (this.max-this.min) * 100;
  this.style.background = 'linear-gradient(to right, red 0%, green ' + value + '%, grey ' + value + '%, white 100%)';
};
getHighScores();
function getHighScores() {
  fetch("http://chernovia.com:8087/scores").then(response => response.json()).then(json => makeHighScoreTable(json))
    .catch((error) => { console.log(error); document.getElementById("high-score-table").hidden = true; });
}

function showHelp() { help_screen.style.display = "block"; }
function showAbout() { about_screen.style.display = "block"; }
function closeHelp() { help_screen.style.display = "none"; }
function closeAbout() { about_screen.style.display = "none"; }

function onLoad() { console.log("Loading...");
  splash_continue_msg.textContent = "Loading...";
  splash_screen.style.display = "block";
  loadAudio();
  fetch("data/lichess_db_puzzle10000.csv",{
    headers: {  'Content-Type': 'text/csv' }
  }).then(response => response.text()).then(text => text.split(/\r\n|\n/)).then(data => {
    fens = data; console.log("Loaded FENs");
    solution_board = new ZugBoard(document.getElementById("solution"),document.getElementById("piece-wrapper"),onPieceLoad,winCheck,winCheck);
  });
}

function onPieceLoad() {
  console.log("Loaded Piece Images");
  splash_continue_msg.textContent = "Click anywhere to continue...";
  splash_screen.onclick = splashClick;
  loadArgs();
}

function loadArgs() {
  let args = getJsonFromUrl();
  if (args.seed !== undefined && args.missing !== undefined) {
    clearSplash();
    updateMissing(args.missing);
    newPuzzle(parseInt(args.seed));
  }
  else {
    updateMissing();
  }
}

function loadAudio() {
  for (let i=0; i<win_sounds.length; i++) win_sounds[i] = new Audio('audio/clips/win' + (i + 1) + '.mp3');
  for (let i=0; i<tracks.length; i++) {
    tracks[i] = new Audio('audio/tracks/track' + (i + 1) +  '.mp3');
    tracks[i].addEventListener('ended', function() {
      current_track = shuffleTrack();
      tracks[current_track].currentTime = 0;
      playMusic();
    },false);
  }
  current_track = shuffleTrack();
}

function copyURL() {
  let url = location.host + location.pathname + "?seed=" + seed + "&missing=" + missing;
  navigator.clipboard.writeText(url).then(() => { alert("Copied: " + url); });
}

function clearSplash() {
  splash_screen.style.display = "none"; splash_screen.onclick = null;
}

function splashClick() {
  clearSplash(); newPuzzle();
}

function toggleMusic(e) {
  music = e.checked;
  if (music) playMusic(); else tracks[current_track].pause();
}

function playMusic() {
  tracks[current_track].play().then(() => { console.log("Starting/resuming playback"); });
}

function shuffleTrack() {
  let new_track = current_track;
  while (current_track === new_track) {
    new_track = Math.floor(Math.random() * tracks.length);
  }
  return new_track;
}

function updateMissing(v) {
  if (v !== undefined) range_missing.value = missing = v;
  else missing = range_missing.valueAsNumber; //console.log("Missing: " + missing);
  document.getElementById("lab_missing").textContent = "Missing Pieces: " + missing;
  if (puzzle !== undefined) newPuzzle(seed);
}

function startGame() {
  if (!playing) {
    player_name = prompt("Enter your name: ");
    getHighScores();
    newPuzzle();
    playing = true; solve_time = default_solve_time; score = 0;
    time_thread = setInterval(()=> {
      txt_time.textContent = "Time: " + new Date(--solve_time * 1000).toISOString().substr(11, 8);
      if (solve_time <= 0) endGame();
    },1000);
    document.getElementById("butt-start").textContent = "Stop";
  }
  else endGame();
}

function endGame() {
  playing = false; clearInterval(time_thread); //alert("Game Over!  Score: " + score);
  fetch("http://chernovia.com:8087/newscore",{
    headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
    method: "post",
    body: JSON.stringify({player:player_name,score: score,level: missing})
  }).then(response => response.text()).then(txt => { console.log(txt); getHighScores(); });
  document.getElementById("butt-start").textContent = "Start";
}

function refresh() {
  if (solution_board !== undefined) {
    ZugBoard.calcBoard(puzzle);
    solution_board.drawGridBoard();
  }
}

function getFen(i) { return fens[i].split(",")[1]; }

function newPuzzle(n) {
  if (n === undefined) seed = Math.round((Math.random() * 999)); else seed = n; //console.log("Seed: " + seed);
  rnd_fun = mulberry32(seed);
  puzzle = []; current_fen_idx = rnd(fens.length);
  for (let x = 0; x < ZugBoard.MAX_FILES; x++) {
    puzzle[x] = [];
    for (let y = 0; y < ZugBoard.MAX_RANKS; y++) puzzle[x][y] = new Square(0);
  }
  ZugBoard.setFEN(puzzle,getFen(current_fen_idx));
  setMissingPieces(puzzle);
  resetSolutionBoard();
  refresh();
}

function resetSolutionBoard() {
  for (let y=0; y<ZugBoard.MAX_RANKS; y++) for (let x=0; x<ZugBoard.MAX_FILES; x++) {
    if (puzzle[x][y].missing) solution_board.squares[x][y].piece = 0; else solution_board.squares[x][y].piece = puzzle[x][y].piece;
  }
  refresh();
}

function setMissingPieces(puzzle) { //console.log("Seed: " + seed + ", " + rnd(999));
  let timeout = 999;
  for (let i=0;i<missing;i++) {
    let ok = false; do {
      let x = rnd(ZugBoard.MAX_FILES), y = rnd(ZugBoard.MAX_RANKS);
      if (puzzle[x][y].piece !== 0 && !puzzle[x][y].missing) { puzzle[x][y].missing = true; ok = true; }
      else if (--timeout < 0) { console.log("Error setting up puzzle"); return; }
    } while (!ok);
  }
}

function winCheck() { //console.log("Checking for winner...");
  for (let y=0; y<ZugBoard.MAX_RANKS; y++) for (let x=0; x<ZugBoard.MAX_FILES; x++) {
    if (solution_board.squares[x][y].piece !== puzzle[x][y].piece) return false;
  } //console.log("Winner! " + missing);
  win_sounds[missing-1].play();
  if (playing) {
    score += (missing * 2); //base_bonus + Math.max((30 * missing) - solve_time,0);
    txt_score.textContent = "Score: " + score;
    animation_start = Date.now(); victoryAnimation();
  }
  return true;
}

function victoryAnimation() {
  if (Date.now() - animation_start < animation_time) {
    solution_board.colorCycle();
    requestAnimationFrame(victoryAnimation);
  }
  else newPuzzle();
}

function setInterpolation() {
  solution_board.interpolated = document.getElementById("chk-lerp").checked;
  solution_board.initPieceBox(refresh,winCheck);
}

function startScrolling() {
  let cssAnimation = document.createElement('style'); //cssAnimation.type = 'text/css';
  let rules = document.createTextNode('@-webkit-keyframes backgroundScroll {' +
    'from {background-position: 0 0;}' +
    'to {background-position: 100vw 50vw;}');
  cssAnimation.appendChild(rules);
  document.getElementsByTagName("head")[0].appendChild(cssAnimation);
}

function makeHighScoreTable(scores) { //console.log(scores);
  let table = document.getElementById("high-score-table");
  while (table.firstChild) table.removeChild(table.lastChild);
  let header_row = document.createElement("tr");
  let player_header = document.createElement("th"); player_header.innerText = "Player";
  let score_header = document.createElement("th"); score_header.innerText = "Score";
  let level_header = document.createElement("th"); level_header.innerText = "Level";
  header_row.appendChild(player_header);
  header_row.appendChild(score_header);
  header_row.appendChild(level_header);
  table.appendChild(header_row);
  for (let i=0;i<scores.length;i++) {
    let entry_row = document.createElement("tr");
    let player_entry = document.createElement("td");
    player_entry.appendChild(document.createTextNode(scores[i].player));
    let score_entry = document.createElement("td");
    score_entry.appendChild(document.createTextNode(scores[i].score));
    let level_entry = document.createElement("td");
    level_entry.appendChild(document.createTextNode(scores[i].level));
    entry_row.appendChild(player_entry);
    entry_row.appendChild(score_entry);
    entry_row.appendChild(level_entry);
    table.appendChild(entry_row);
  }
}

function getJsonFromUrl(url) {
  if(!url) url = location.search;
  let query = url.substr(1);
  let result = {};
  query.split("&").forEach(function(part) {
    let item = part.split("=");
    result[item[0]] = decodeURIComponent(item[1]);
  });
  return result;
}

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function rnd(n) { return Math.floor(rnd_fun() * n); }
