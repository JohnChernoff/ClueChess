//TODO: give hints (missing square highlighted, etc.), option for "normal" squares/pieces
const PIECE_CHRS = "kqrbnp-PNBRQK";
let current_fen;
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
let win_sounds = [];
let music = false;
let theme = new Audio('audio/ClueChess1.mp3');
let help_screen = document.getElementById("modal-help-overlay");
let about_screen = document.getElementById("modal-about-overlay");
let splash_screen = document.getElementById("splash");
let splash_continue_msg = document.getElementById("txt_continue");
let txt_time = document.getElementById("text-time");
let txt_score = document.getElementById("text-score");
let chk_verbose = document.getElementById("chk-verbose");
let range_missing = document.getElementById("range-missing");
range_missing.oninput = function() {
  let value = (this.value-this.min)/(this.max-this.min)*100;
  this.style.background = 'linear-gradient(to right, red 0%, green ' + value + '%, grey ' + value + '%, white 100%)';
};
updateMissing(true);
getHighScores();
function getHighScores() {
  fetch("http://chernovia.com:8087/scores").then(response => response.json()).then(json => makeHighScoreTable(json));
}

function showHelp() { help_screen.style.display = "block"; }
function showAbout() { about_screen.style.display = "block"; }
function closeHelp() { help_screen.style.display = "none"; }
function closeAbout() { about_screen.style.display = "none"; }

function onLoad() { console.log("Loading...");
  splash_continue_msg.textContent = "Loading...";
  splash_screen.style.display = "block";
  for (let i=1; i<=8; i++) win_sounds[i-1] = new Audio('audio/win' + i + '.mp3'); //don't wait on these
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
}

function splashClick() {
  splash_screen.style.display = "none"; splash_screen.onclick = null; //theme.play();
  newPuzzle();
}

function toggleMusic(e) {
  music = e.checked;
  if (music) { //startScrolling();
    theme.play().then();
  } else theme.pause();
}

function updateMissing(init) {
  missing = range_missing.valueAsNumber;
  document.getElementById("lab_missing").textContent = "Missing Pieces: " + missing;
  if (!init) newPuzzle(current_fen);
}

function startScrolling() {
  let cssAnimation = document.createElement('style'); //cssAnimation.type = 'text/css';
  let rules = document.createTextNode('@-webkit-keyframes backgroundScroll {' +
  'from {background-position: 0 0;}' +
  'to {background-position: 100vw 50vw;}');
  cssAnimation.appendChild(rules);
  document.getElementsByTagName("head")[0].appendChild(cssAnimation);
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

function newPuzzle(fen) {
  if (fen === undefined) initPuzzle(puzzle,fens[rnd(fens.length)].split(",")[1]); else initPuzzle(puzzle,fen);
  refresh();
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

function initPuzzle(puzzle,fen) { //console.log("FEN: " + fen);
  current_fen = fen;
  for (let x = 0; x < ZugBoard.MAX_FILES; x++) {
    puzzle[x] = [];
    for (let y = 0; y < ZugBoard.MAX_RANKS; y++) puzzle[x][y] = new Square(0);
  }
  ZugBoard.setFEN(puzzle,fen);
  setMissingPieces(puzzle);
  resetSolutionBoard();
}

function resetSolutionBoard() {
  for (let y=0; y<ZugBoard.MAX_RANKS; y++) for (let x=0; x<ZugBoard.MAX_FILES; x++) {
    if (puzzle[x][y].missing) solution_board.squares[x][y].piece = 0; else solution_board.squares[x][y].piece = puzzle[x][y].piece;
  }
  refresh();
}

function setMissingPieces(puzzle) {
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

function rnd(n) { return Math.floor(Math.random() * n); }

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

function setInterpolation() {
  solution_board.interpolated = document.getElementById("chk-lerp").checked;
  solution_board.initPieceBox(refresh,winCheck);
}
