//TODO: give hints (missing square highlighted, etc.)
const PIECE_CHRS = "kqrbnp-PNBRQK";
let tutorial_lvl = -1;
let tutorial_content = [
  { fen: "4k3/4p3/8/8/4N3/8/4P3/4K3 w - - 0 1", missing: [{file: 4, rank: 4}], txt:
      "Welcome to ClueChess!  I'm your guide, Moleiarty.  Let's get started!   Each puzzle has one or more missing chess pieces that you must discover - your only " +
      "clues are the numbers on some squares, indicating the aggregate control over that square by each side.  Right-click anywhere on the board to add/change a piece.  " +
      "Let's start with a simple example: note the numbers form a 'wheel' pattern, suggesting a certain piece - can you figure out which?",
    err: "Sorry, that's not the right piece or piece color.  Here's a hint: note that none of the numbers directly align with each other.  What chess piece doesn't move " +
      "in a straight line?"  },
  { fen: "7k/8/8/8/rb6/8/8/1R5K w - - 0 1",  missing: [{file: 1, rank: 4}], txt:
      "Well done - Knights are tricky!  Now see if you can figure out why there's so many numbers in this next puzzle.",
    err: "Sorry!  That's not the right answer.  Here's a hint: numbers not only suggest squares controlled by a hidden piece but also squares " +
      "blocked from being controlled by other pieces by a hidden piece.  In this case there are lots of numbers in a line radiating from each rook - what might that " +
      "suggest to you?" },
  { fen: "r4rk1/pbppbppp/1p2p3/4P3/1q2n3/2N2QP1/PPBP1P1P/R1B1R1K1 w Qq - 0 1",  missing: [{file: 4, rank: 4}], txt:
      "That blocky black bishop!  Now see if you can sort out the mess in this one - again there is only one missing piece...",
    err: "Sorry!  That's not the right answer.  Try again!" },
  { fen: "r3k2r/p2nbppp/bpn1p3/q1ppP3/N2P1P1P/1PP1BN2/P4KP1/R2Q1B1R b kq - 0 12",  missing: [{file: 0, rank: 2},{file: 0, rank: 3},{file: 0, rank: 4}], txt:
      "Great job - I see you've got the hang of this now!  As a graduation gift for finishing this tutorial, I'll leave you with a multiple piece puzzle to work out on " +
      "your own.  Good luck!"
  }
];

let current_fen_idx;
let fens;
let puzzle = [];
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
let tutorial_screen = document.getElementById("modal-tutorial-overlay");
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
function closeTutorial() { tutorial_screen.style.display = "none"; solution_board.editable = true; }
function showTutorial(msg) {
  tutorial_screen.style.display = "block";
  solution_board.editable = false;
  document.getElementById("txt-tutorial").textContent = msg;
}

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
    setMissing(args.missing);
    newPuzzle(parseInt(args.seed));
  }
  else {
    updateMissing(false);
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
    new_track = rnd(tracks.length);
  }
  return new_track;
}

function updateMissing(reload) {
  setMissing(range_missing.valueAsNumber);
  if (reload) newPuzzle(seed);
}

function setMissing(v) {
  range_missing.value = missing = v;
  document.getElementById("lab_missing").textContent = "Missing Pieces: " + missing;
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
  current_fen_idx = seedy_rnd(fens.length);
  newFEN(getFen(current_fen_idx));
}

function newFEN(fen,list) { //console.log("FEN: " + fen);

  puzzle = [];
  for (let x = 0; x < ZugBoard.MAX_FILES; x++) {
    puzzle[x] = [];
    for (let y = 0; y < ZugBoard.MAX_RANKS; y++) puzzle[x][y] = new Square(0);
  }

  ZugBoard.setFEN(puzzle,fen);
  setMissingPieces(list);
  resetSolutionBoard();
  refresh();
}

function resetSolutionBoard() {
  for (let y=0; y<ZugBoard.MAX_RANKS; y++) for (let x=0; x<ZugBoard.MAX_FILES; x++) {
    if (puzzle[x][y].missing) solution_board.squares[x][y].piece = 0; else solution_board.squares[x][y].piece = puzzle[x][y].piece;
  }
  refresh();
}

function setMissingPieces(list) {
  if (list !== undefined) {
    setMissing(list.length);
    for (let i=0;i<list.length;i++) {
      puzzle[list[i].file][list[i].rank].missing = true;
    }
  }
  else {
    let timeout = 999;
    for (let i=0;i<missing;i++) {
      let ok = false; do {
        let x = seedy_rnd(ZugBoard.MAX_FILES), y = seedy_rnd(ZugBoard.MAX_RANKS);
        if (puzzle[x][y].piece !== 0 && !puzzle[x][y].missing) { puzzle[x][y].missing = true; ok = true; }
        else if (--timeout < 0) { console.log("Error setting up puzzle"); return; }
      } while (!ok);
    }
  }
}

function winCheck() { //console.log("Checking for winner...");
  for (let y=0; y<ZugBoard.MAX_RANKS; y++) for (let x=0; x<ZugBoard.MAX_FILES; x++) {
    if (solution_board.squares[x][y].piece !== puzzle[x][y].piece) {
      if (tutorial_lvl >= 0) runTutorial();
      return false;
    }
  } //console.log("Winner! " + missing);
  win_sounds[missing-1].play();
  if (playing) {
    score += (missing * 2); //base_bonus + Math.max((30 * missing) - solve_time,0);
    txt_score.textContent = "Score: " + score;
    animation_start = Date.now(); victoryAnimation();
  }
  else if (tutorial_lvl >= 0) {
    //animation_start = Date.now(); victoryAnimation();
    runTutorial(tutorial_lvl + 1);
  }
  return true;
}

//TODO: make async
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

function runTutorial(lvl) {
  if (lvl !== undefined) {
    tutorial_lvl = lvl;
    showTutorial(tutorial_content[tutorial_lvl].txt);
  }
  else showTutorial(tutorial_content[tutorial_lvl].err);
  newFEN(tutorial_content[tutorial_lvl].fen,tutorial_content[tutorial_lvl].missing);
  if (tutorial_lvl >= tutorial_content.length-1) tutorial_lvl = -1;
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

function seedy_rnd(n) { return Math.floor(rnd_fun() * n); }
function rnd(n) { return Math.floor(Math.random() * n); }

