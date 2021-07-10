const RED = 0, GREEN = 1, BLUE = 2;
const PIECE_CHRS = "kqrbnp-PNBRQK";
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PUZZLE_FEN = "r1bqk2r/pppnppbp/3p1np1/8/2BP1P2/4PN2/PPP3PP/RNBQK2R w KQkq - 5 6";
let piece_imgs = [];
let puzzle_board = { squares: [], canvas: null, ctx: null };
let solution_board = [];
let max_files = 8, max_ranks = 8;
let hint_lvl = 5, max_hints = 5;
let dragging = null;
show_control = true;

function onLoad() {
  initBoard(puzzle_board,document.getElementById("puzzle_canvas"));
  initGridBoard(solution_board,document.getElementById("solution"));
  for (let i=0; i<6; i++) {
    piece_imgs[i] = { black: new Image(), white: new Image() }; //onload?
    piece_imgs[i].black.src = "img/pieces/b" + (i+1) + ".svg";
    piece_imgs[i].white.src = "img/pieces/w" + (i+1) + ".svg";
  }
}

function initBoard(board,canvas) {
  board.canvas = canvas; board.ctx = canvas.getContext("2d");
  canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight;
  for (let x= 0; x < max_files; x++) {
    board.squares[x] = [];
    for (let y = 0; y < max_ranks; y++) {
      board.squares[x][y] = { piece: 0, control: 0, color: rgb(0,0,0), hint_lvl : rnd(max_hints) };
    }
  }
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
      board[file][rank] = {
        piece: 0, control: 0, hint_lvl: 0, color: rgb(0,0,0), ctx : can.getContext("2d"), canvas: can
      };
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
        drawGridBoard(board,show_control);
      });
      can.addEventListener("click", ev => {
        let coord = getCoords(ev.target.id); scrollPiece(board,board[coord.x][coord.y],1);
      });
      can.addEventListener("contextmenu",ev => {
        let coord = getCoords(ev.target.id); scrollPiece(board,board[coord.x][coord.y],-1);
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
  let i = parseInt(id); return { x: id % max_files, y: Math.floor(id / max_ranks) };
}

function nextHint() {
  if (hint_lvl > 0) hint_lvl--;
  for (let y=0;y<max_ranks;y++) for (let x=0;x<max_files;x++) {
    if (puzzle_board.squares[x][y].hint_lvl >= hint_lvl) solution_board[x][y].piece = puzzle_board.squares[x][y].piece;
    else solution_board[x][y].piece = 0;
  }
  drawBoard(puzzle_board,true);
  drawGridBoard(solution_board,show_control);
}

function newPuzzle() {
  hint_lvl = 5;
  setFEN(puzzle_board.squares,PUZZLE_FEN);
  drawBoard(puzzle_board,true);
  setFEN(solution_board,START_FEN);
  drawGridBoard(solution_board,show_control);
}

function drawBoard(board,show_pieces) {
  calcBoard(board.squares);
  let sqr_w = Math.round(board.canvas.width/max_files), sqr_h = Math.round(board.canvas.height/max_ranks);
  drawInterpolatedBoard(board,getInterpolatedBoard(board.squares,sqr_w,sqr_h));
  for (let y=0;y<max_ranks;y++) for (let x=0;x<max_files;x++) {
    drawControl(board,sqr_w,sqr_h,x,y);
    if (show_pieces && board.squares[x][y].hint_lvl >= hint_lvl) drawPiece(board,sqr_w,sqr_h,x,y);
    board.ctx.strokeStyle = "white"; board.ctx.strokeRect((sqr_w * x),(sqr_h * y) ,sqr_w,sqr_h);
  }
}

function drawGridBoard(squares,show_control) {
  calcBoard(squares);
  drawInterpolatedSquares(squares);
  if (show_control) showGridControlNumbers(squares,puzzle_board.squares);
  for (let y=0;y<max_ranks;y++) for (let x=0;x<max_files;x++) drawGridPiece(squares[x][y]);
}

function drawPiece(board,w,h,x,y) {
  let dx = w * x, dy = h * y, square = board.squares[x][y];
  if (square.piece > 0) board.ctx.drawImage(piece_imgs[square.piece-1].white,dx+(w/4),dy+(h/4),w/2,h/2);
  else if (square.piece < 0) board.ctx.drawImage(piece_imgs[-square.piece-1].black,dx+(w/4),dy+(h/4),w/2,h/2);
}

function drawControl(board,w,h,x,y) {
  let dx = w * x, dy = h * y, square = board.squares[x][y];
  let w2 = w/2, w4 = w/4, h2 = h/2;
  board.ctx.font = 'bold ' + w4 + 'px fixedsys';
  board.ctx.fillStyle = "yellow";
  board.ctx.fillText(""+ square.control,dx + (w4/2) ,dy + w4);
}

function drawGridPiece(square) {
  let w2 = square.canvas.width/2, w4 = square.canvas.width/4, h2 = square.canvas.height/2, h4 = square.canvas.height/3;
  if (square.piece > 0) square.ctx.drawImage(piece_imgs[square.piece-1].white,w4,h4,w2,h2);
  else if (square.piece < 0) square.ctx.drawImage(piece_imgs[-square.piece-1].black,w4,h4,w2,h2);
}

function drawInterpolatedSquares(squares) {
  let pix_array = getInterpolatedBoard(squares,squares[0][0].canvas.width,squares[0][0].canvas.height);
  for (let y = 0; y < max_ranks; y++) {
    for (let x = 0; x < max_files; x++) {
      squares[x][y].ctx.putImageData(getInterpolatedSquare(x,y,squares[x][y].canvas.width,squares[x][y].canvas.height,pix_array),0,0);
    }
  }
}

function calcBoard(squares) {
  for (let y = 0;y < max_ranks; y++) {
    for (let x = 0; x < max_files; x++) {
      squares[x][y].control = getControl(x,y,squares,false);
      squares[x][y].color = getColor(squares[x][y]);
    }
  }
}

function showGridControlNumbers(squares,puzzle_squares) {
  for (let y=0;y<max_ranks;y++) {
    for (let x=0;x<max_files;x++) {
      let w4 = (squares[x][y].canvas.width/4);
      squares[x][y].ctx.font = 'bold ' + w4 + 'px fixedsys';
      if (squares[x][y].control === puzzle_squares[x][y].control) squares[x][y].ctx.fillStyle = "white";
      else squares[x][y].ctx.fillStyle = "red";
      squares[x][y].ctx.fillText(squares[x][y].control + "/" + puzzle_squares[x][y].control,1,w4);
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

function drawInterpolatedBoard(board,pix_array) {
  let square_width = Math.round(board.canvas.width/max_files), square_height = Math.round(board.canvas.height/max_ranks);
  let img_data = board.ctx.createImageData(board.canvas.width,board.canvas.height), pixels = img_data.data;
  for (let py = 0; py < board.canvas.height; py++) {
    for (let px = 0; px < board.canvas.width; px++) {
      setPixel((py * img_data.width + px) * 4,pixels,pix_array[px + square_width][py + square_height]);
    }
  }
  board.ctx.putImageData(img_data,0,0);
}

function setPixel(offset,pixels,pix_array) {
  pixels[offset] = pix_array[0];
  pixels[offset + 1] = pix_array[1];
  pixels[offset + 2] = pix_array[2];
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
  r = Math.floor(r);
  g = Math.floor(g);
  b = Math.floor(b);
  return ["rgb(",r,",",g,",",b,")"].join("");
}

function rgb2array(rgb) {
  return rgb.match(/\d+/g);
}

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

function rnd(n) {
  return Math.floor(Math.random() * n);
}

function setHints(squares) {
  for (let y=0;y<max_ranks;y++) for (let x=0;x<max_files;x++) squares[x][y].hint_lvl = rnd(max_hints);
}
