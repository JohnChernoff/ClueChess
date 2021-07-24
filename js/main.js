const RED = 0, GREEN = 1, BLUE = 2;
const PIECE_CHRS = "kqrbnp-PNBRQK";
let current_fen;
let fens;
let piece_imgs = [];
let puzzle = [];
let solution_board = [];
let max_files = 8, max_ranks = 8;
let missing = 3;
let dragging = null;
let show_control = true;
let time_thread = null;
let playing = false;
let animation_start;
let animation_time = 2000;
let default_solve_time = 180;
let solve_time, score; //let base_bonus = 60;
let win_sounds = [];
let help_screen = document.getElementById("modal-help-overlay");
let txt_time = document.getElementById("text-time");
let txt_score = document.getElementById("text-score");
let chk_verbose = document.getElementById("chk-verbose");
let range_missing = document.getElementById("range-missing");
range_missing.oninput = function() {
  let value = (this.value-this.min)/(this.max-this.min)*100;
  this.style.background = 'linear-gradient(to right, red 0%, green ' + value + '%, grey ' + value + '%, white 100%)';
};
setMissing(true);

function showHelp() { help_screen.style.display = "block"; }
function closeHelp() { help_screen.style.display = "none"; }

function setMissing(init) {
  missing = range_missing.valueAsNumber;
  document.getElementById("lab_missing").textContent = "Missing Pieces: " + missing;
  if (!init) newPuzzle(current_fen);
}

function Square(piece,canvas) {
  this.piece = piece;
  this.control = 0;
  this.color = rgb(0,0,0);
  this.missing = false;
  if (canvas !== undefined) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }
}

function onLoad() {
  initGridBoard(solution_board,document.getElementById("solution"));
  for (let i=0; i<6; i++) {
    piece_imgs[i] = { black: new Image(), white: new Image() }; //onload?
    piece_imgs[i].black.src = "img/pieces/b" + (i+1) + ".svg";
    piece_imgs[i].white.src = "img/pieces/w" + (i+1) + ".svg";
  }
  for (let i=1; i<=8; i++) win_sounds[i-1] = new Audio('audio/win' + i + '.mp3');
  loadFENs();
}

function loadFENs() {
  fetch("data/lichess_db_puzzle10000.csv",{
    headers: {  'Content-Type': 'text/csv' }
  }).then(response => response.text()).then(text => text.split(/\r\n|\n/)).then(data => {
    fens = data;
    newPuzzle();
  }); console.log("Loaded FENs");
}

function startGame() {
  newPuzzle();
  playing = true; solve_time = default_solve_time; score = 0;
  time_thread = setInterval(()=> {
    txt_time.textContent = "Time: " + new Date(--solve_time * 1000).toISOString().substr(11, 8);
    if (solve_time <= 0) endGame();
  },1000);
}

function newPuzzle(fen) {
  if (fen === undefined) initPuzzle(puzzle,fens[rnd(fens.length)].split(",")[1]); else initPuzzle(puzzle,fen);
  refresh();
}

function endGame() {
  playing = false; clearInterval(time_thread); alert("Game Over!  Score: " + score);
}

function refresh() {
  calcBoard(puzzle);
  drawGridBoard(solution_board,show_control);
}

function initPuzzle(puzzle,fen) { //console.log("FEN: " + fen);
  current_fen = fen;
  for (let x = 0; x < max_files; x++) {
    puzzle[x] = [];
    for (let y = 0; y < max_ranks; y++) puzzle[x][y] = new Square(0);
  }
  setFEN(puzzle,fen);
  setMissingPieces(puzzle);
  resetSolutionBoard();
}

function resetSolutionBoard() {
  for (let y=0;y<max_ranks;y++) for (let x=0;x<max_files;x++) {
    if (puzzle[x][y].missing) solution_board[x][y].piece = 0; else solution_board[x][y].piece = puzzle[x][y].piece;
  }
  refresh();
}

function setMissingPieces(puzzle) {
  let timeout = 999;
  for (let i=0;i<missing;i++) {
    let ok = false; do {
      let x = rnd(max_files), y = rnd(max_ranks);
      if (puzzle[x][y].piece !== 0 && !puzzle[x][y].missing) { puzzle[x][y].missing = true; ok = true; }
      else if (--timeout < 0) { console.log("Error setting up puzzle"); return; }
    } while (!ok);
  }
}

function winCheck() { //console.log("Checking for winner...");
  for (let y=0;y<max_ranks;y++) for (let x=0;x<max_files;x++) {
    if (solution_board[x][y].piece !== puzzle[x][y].piece) return false;
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
    colorCycle(solution_board);
    requestAnimationFrame(victoryAnimation);
  }
  else newPuzzle();
}

function initGridBoard(board,wrapper) {
  for (let file=0;file<max_files;file++) board[file] = [];
  for (let rank=0;rank<max_ranks;rank++) {
    for (let file=0;file<max_files;file++) {
      let div = document.createElement("div");
      wrapper.appendChild(div);
      let can = document.createElement("canvas");
      can.id = "" + (file + (rank * max_ranks));
      can.draggable = true;
      can.style.width = div.clientWidth + "px";
      can.style.height = div.clientHeight + "px";
      can.width = div.clientWidth; can.height = div.clientHeight; //console.log(can.width + "," + div.clientWidth);
      div.appendChild(can);
      board[file][rank] = new Square(0,can);
      can.addEventListener("dragstart", ev => {  //console.log("Drag start: " + ev.target.id);
        let coord = getCoords(ev.target.id); dragging = { from: board[coord.x][coord.y], to: null };
      })
      can.addEventListener("dragenter", ev => {
        let coord = getCoords(ev.target.id); dragging.to = board[coord.x][coord.y];
      });
      can.addEventListener("dragend", ev => {
        let rect = wrapper.getBoundingClientRect();
        if (inBounds(ev.pageX,ev.pageY,rect)) dragging.to.piece = dragging.from.piece;
        dragging.from.piece = 0; dragging = null;
        drawGridBoard(board,show_control); winCheck();
      });
      can.addEventListener("click", ev => {
        let coord = getCoords(ev.target.id); scrollPiece(board,board[coord.x][coord.y],1); winCheck();
      });
      can.addEventListener("contextmenu",ev => {
        let coord = getCoords(ev.target.id); scrollPiece(board,board[coord.x][coord.y],-1); winCheck();
        ev.preventDefault();
      });
    }
  }
}

function scrollPiece(board,square,dir) {
  square.piece += dir;
  if (square.piece > KING) square.piece = -KING;
  else if (square.piece < -KING) square.piece = KING;
  drawGridBoard(board,show_control);
}

function getCoords(id) {
  return { x: id % max_files, y: Math.floor(id / max_ranks) };
}

function calcBoard(squares) {
  for (let y = 0;y < max_ranks; y++) {
    for (let x = 0; x < max_files; x++) {
      squares[x][y].control = getControl(x,y,squares,false);
      squares[x][y].color = getColor(squares[x][y]);
    }
  }
}

function drawGridBoard(squares,show_control) {
  calcBoard(squares);
  drawInterpolatedSquares(squares);
  if (show_control) drawGridControlNumbers(squares,puzzle);
  for (let y=0;y<max_ranks;y++) for (let x=0;x<max_files;x++) drawGridPiece(squares[x][y]);
}

function drawGridPiece(square) { //console.log(square);
  if (!square.missing && square.piece !== 0) {
    let w2 = square.canvas.width/2, w4 = square.canvas.width/4, h2 = square.canvas.height/2, h4 = square.canvas.height/3;
    if (square.piece > 0) square.ctx.drawImage(piece_imgs[square.piece-1].white,w4,h4,w2,h2);
    else square.ctx.drawImage(piece_imgs[-square.piece-1].black,w4,h4,w2,h2);
  }
}

function drawGridControlNumbers(squares,puzzle_squares) {
  for (let y=0;y<max_ranks;y++) {
    for (let x=0;x<max_files;x++) {
      let w4 = (squares[x][y].canvas.width/4);
      squares[x][y].ctx.font = 'bold ' + w4 + 'px fixedsys';
      if (squares[x][y].control !== puzzle_squares[x][y].control) {
        if (chk_verbose.checked) {
          squares[x][y].ctx.fillStyle = "red";
          squares[x][y].ctx.fillText(squares[x][y].control,8,w4);
        }
        squares[x][y].ctx.fillStyle = "darkgrey";
        squares[x][y].ctx.fillText(puzzle_squares[x][y].control,squares[x][y].canvas.width-w4,w4);
      }
    }
  }
}

function drawInterpolatedSquares(squares) {
  let pix_array = getInterpolatedBoard(squares,squares[0][0].canvas.width,squares[0][0].canvas.height);
  for (let y = 0; y < max_ranks; y++) {
    for (let x = 0; x < max_files; x++) {
      squares[x][y].ctx.putImageData(getInterpolatedSquare(x,y,squares[x][y].canvas.width,squares[x][y].canvas.height,pix_array),0,0);
    }
  }
}

function getInterpolatedBoard(squares,square_width,square_height) {
  let edge_col = [0,0,0];
  let padded_board_width = square_width * (max_files+2), padded_board_height = square_height * (max_ranks+2);
  let pix_array = [];
  for (let w=0; w < (padded_board_width); w++) {
    pix_array[w] = [];
      for (let h=0; h < (padded_board_height); h++) {
      pix_array[w][h] = [];
      for (let i = 0; i < 3; i++) pix_array[w][h][i] = 0;
    }
  }
  let rect = { left: 0, top: 0, right: max_files-1, bottom: max_ranks-1 };
  let x_center = Math.floor(square_width/2), y_center = Math.floor(square_height/2);
  for (let nx = -1; nx < 8; nx++) {
    for (let ny = -1; ny < 8; ny++) {
      let sqr_x = Math.floor(((nx + 1) * square_width) + x_center);
      let sqr_y = Math.floor(((ny + 1) * square_height) + y_center);
      let c1 = inBounds(nx, ny, rect) ? rgb2array(squares[nx][ny].color) : edge_col;
      let c2 = inBounds(nx + 1, ny, rect) ? rgb2array(squares[nx + 1][ny].color) : edge_col;
      let c3 = inBounds(nx, ny + 1, rect) ? rgb2array(squares[nx][ny + 1].color) : edge_col;
      let c4 = inBounds(nx + 1, ny + 1, rect) ? rgb2array(squares[nx + 1][ny + 1].color) : edge_col;
      for (let i = 0; i < 3; i++) {
        for (let lerp_x = 0; lerp_x < square_width; lerp_x++) {
          let v = lerp_x / square_width, x = sqr_x + lerp_x, bottom_y = sqr_y + square_height;
          //interpolate right
          pix_array[x][sqr_y][i] = Math.floor(lerp(v, c1[i], c2[i]));
          //interpolate right and below
          pix_array[x][bottom_y][i] = Math.floor(lerp(v, c3[i], c4[i]));
          //interpolate down
          for (let lerp_y = 0; lerp_y < square_height; lerp_y++) {
            let y = sqr_y + lerp_y; v = lerp_y / square_height;
            pix_array[x][y][i] = Math.floor(lerp(v, pix_array[x][sqr_y][i], pix_array[x][bottom_y][i]));
          }
        }
      }
    }
  }
  return pix_array;
}

function getInterpolatedSquare(file,rank,square_width,square_height,pix_array) {
  let img_data = new ImageData(square_width,square_height); let pixels = img_data.data;
  let array_x = square_width + (file * square_width), array_y = square_height + (rank * square_height); //pix_array is 10x10
  for (let py = 0; py < square_height; py++) {
    for (let px = 0; px < square_width; px++) {
      setPixel((py * img_data.width + px) * 4,pixels,pix_array[array_x + px][array_y + py]);
    }
  }
  return img_data;
}

function setPixel(offset,pixels,pix_array) {
  pixels[offset] = pix_array[0]; pixels[offset + 1] = pix_array[1]; pixels[offset + 2] = pix_array[2];
  pixels[offset + 3] = 255;
}

function lerp(v, start, end) {
  return (1 - v) * start + v * end;
}

function inBounds(x,y,rect) {
  return (x >= rect.left && y >= rect.top && x <= rect.right && y <= rect.bottom);
}

function getColor(square) {
  return getTwoColor(square,RED,GREEN,BLUE);
}

function getTwoColor(square,blackColor,voidColor,whiteColor) {
  let color_matrix = [];
  let control_grad = 256 / MAX_CONTROL;
  let c = square.control * control_grad;
  if (c < 0) {
    color_matrix[blackColor] = Math.abs(c); color_matrix[voidColor] = 0; color_matrix[whiteColor] = 0;
  }
  else {
    color_matrix[blackColor] = 0; color_matrix[voidColor] = 0; color_matrix[whiteColor] = Math.abs(c);
  }
  return rgb(color_matrix[0],color_matrix[1],color_matrix[2]);
}

function rgb(r, g, b){
  r = Math.floor(r); g = Math.floor(g); b = Math.floor(b);
  return ["rgb(",r,",",g,",",b,")"].join("");
}

function rgb2array(rgb) {
  return rgb.match(/\d+/g);
}

function colorCycle(board) {
  for (let y=0;y<max_ranks;y++) for (let x=0;x<max_files;x++) squareCycle(board[x][y].canvas,board[x][y].ctx);
}

function squareCycle(canvas,ctx) {
  let img_data = ctx.getImageData(0,0,canvas.width,canvas.height); let pixels = img_data.data;
  for (let i = 0; i < pixels.length; i+=4) {
    for (let c = 0; c < 3; c++) {
      let p = i + c; let v = Math.random() < .5 ? -4 : 4; pixels[p] += v;
      if (pixels[p] > 255) pixels[p] = 0; else if (pixels[p] < 0) pixels[p] = 255;
    }
    pixels[i+3] = 255;
  }
  ctx.putImageData(img_data,0,0);
}

function rnd(n) { return Math.floor(Math.random() * n); }

function setFEN(squares,fen) { //console.log("FEN: " + fen);
  for (let y=0;y<max_ranks;y++) for (let x=0;x<max_files;x++) squares[x][y].piece = 0;
  let ranks = fen.split(" ")[0].split("/");
  for (let rank = 0; rank < ranks.length; rank++) {
    let file = 0;
    for (let i = 0; i < ranks[rank].length; i++) {
      let char = ranks[rank].charAt(i);
      let piece = PIECE_CHRS.indexOf(char);
      if (piece === -1) file += parseInt(char); else {
        squares[file++][rank].piece = piece - 6;
      }
    }
  }
}
