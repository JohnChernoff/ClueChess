function Square(piece,shade,canvas) {
  this.piece = piece;
  this.control = 0;
  this.color = rgb(0,0,0);
  this.missing = false;
  if (shade !== undefined) {
    this.shade = shade;
  }
  if (canvas !== undefined) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }
}

class ZugBoard {

  static DARK = 0;
  static LIGHT = 1;
  static RED = 0;
  static GREEN = 1;
  static BLUE = 2;
  static MAX_FILES = 8;
  static MAX_RANKS = 8;

  editable = true;
  interpolated = true;
  img_light_sqr;
  img_dark_sqr;
  board_background_color = [0,0,0]; //[255,255,255]; //[36,222,255];
  piece_wrapper;
  dragging = null;
  piece_imgs = [];
  pieces_loaded = 0;
  selected_square;
  verbose = false;
  show_control = true;
  squares = [];

  constructor(board_wrapper,piece_wrapper,load_fun,click_fun,choose_fun) {
    this.piece_wrapper = piece_wrapper;
    this.initPieceBox(load_fun,choose_fun);
    this.initGridBoard(board_wrapper,click_fun);
    this.img_light_sqr = new Image(); this.img_light_sqr.src = "img/light_square2.jpg";
    this.img_dark_sqr = new Image(); this.img_dark_sqr.src = "img/dark_square2.jpg";
  }

  fetchPiece(color,i,img,style,type,load_fun,choose_fun) {
    let id = color + i; let p = color === "w" ? i : -i;
    img.onload = () => {
      console.log("Loaded: " + id + ", " + this.pieces_loaded);
      if (++this.pieces_loaded >= 12) load_fun();
    }
    img.addEventListener("click", () => { this.choosePiece(p,choose_fun); });
    img.classList.add("piece-choice");
    img.src = "img/pieces/" + style + "/" + id + type;
  }

  initPieceBox(load_fun,choose_fun) {
    this.pieces_loaded = 0;
    for (let i=0;i<6;i++) {
      this.piece_imgs[i] = { black: new Image(), white: new Image() };
      this.fetchPiece("b",i+1,this.piece_imgs[i].black,"svg",".svg",load_fun,choose_fun);
      this.fetchPiece("w",i+1,this.piece_imgs[i].white,"svg",".svg",load_fun,choose_fun);
    }
    let box = document.getElementById("piece-box");
    while (box.firstChild) {
      box.removeChild(box.firstChild);
    }
    for (let i=0; i<6;i++) box.appendChild(this.piece_imgs[i].black);
    let empty_square_img = new Image(); empty_square_img.src = "img/x.png";
    empty_square_img.classList.add("piece-choice");
    empty_square_img.addEventListener("click",() => { this.choosePiece(0,choose_fun); });
    box.appendChild(empty_square_img);
    for (let i=0; i<6;i++) box.appendChild(this.piece_imgs[i].white);
    let cancel_square_img = new Image(); cancel_square_img.src = "img/undo.png";
    cancel_square_img.classList.add("piece-choice");
    cancel_square_img.addEventListener("click",() => { this.choosePiece(undefined,choose_fun); });
    box.appendChild(cancel_square_img);
  }

  initGridBoard(wrapper,click_fun) {
    for (let file=0; file<ZugBoard.MAX_FILES; file++) this.squares[file] = [];
    for (let rank=0; rank<ZugBoard.MAX_RANKS; rank++) {
      for (let file=0; file<ZugBoard.MAX_FILES; file++) {
        let div = document.createElement("div");
        wrapper.appendChild(div);
        let can = document.createElement("canvas");
        can.id = "" + (file + (rank * ZugBoard.MAX_RANKS));
        can.draggable = true;
        can.style.width = div.clientWidth + "px";
        can.style.height = div.clientHeight + "px";
        can.width = div.clientWidth; can.height = div.clientHeight; //console.log(can.width + "," + div.clientWidth);
        div.appendChild(can);
        let shade = ((file + rank) % 2) === 0 ? ZugBoard.LIGHT : ZugBoard.DARK;
        this.squares[file][rank] = new Square(0,shade,can);
        can.addEventListener("dragstart", ev => {  //console.log("Drag start: " + ev.target.id);
          if (this.editable) {
            let coord = ZugBoard.getCoords(ev.target.id);
            this.dragging = { from: this.squares[coord.x][coord.y], to: null };
          }
        })
        can.addEventListener("dragenter", ev => {
          if (this.editable) {
            let coord = ZugBoard.getCoords(ev.target.id);
            this.dragging.to = this.squares[coord.x][coord.y]; //TODO: bug?
          }
        });
        can.addEventListener("dragend", ev => {
          if (this.editable) {
            let rect = wrapper.getBoundingClientRect();
            if (ZugBoard.inBounds(ev.pageX,ev.pageY,rect)) this.dragging.to.piece = this.dragging.from.piece;
            this.dragging.from.piece = 0; this.dragging = null;
            this.drawGridBoard();
            click_fun();
          }
        });
        can.addEventListener("click", ev => {
          if (this.editable) {
            let coord = ZugBoard.getCoords(ev.target.id);
            this.scrollPiece(this.squares[coord.x][coord.y],1);
            click_fun();
          }
        });
        can.addEventListener("contextmenu",ev => {
          if (this.editable) {
            let coord = ZugBoard.getCoords(ev.target.id);
            this.selected_square = this.squares[coord.x][coord.y];
            this.piece_wrapper.style.left = ev.pageX + "px";
            this.piece_wrapper.style.top = ev.pageY + "px";
            this.piece_wrapper.style.display = "block";
            ev.preventDefault();
          }
        });
      }
    }
  }

  choosePiece(p,choose_fun) {
    this.piece_wrapper.style.display = "none";
    if (p !== undefined) {
      this.selected_square.piece = p; refresh(); choose_fun();
    }
  }

  scrollPiece(square,dir) {
    square.piece += dir;
    if (square.piece > KING) square.piece = -KING;
    else if (square.piece < -KING) square.piece = KING;
    this.drawGridBoard();
  }

  drawGridBoard() {
    ZugBoard.calcBoard(this.squares);
    if (this.interpolated) this.drawInterpolatedSquares(); else this.drawSquares();
    if (this.show_control) this.drawGridControlNumbers(puzzle);
    for (let y=0; y<ZugBoard.MAX_RANKS; y++) for (let x=0; x<ZugBoard.MAX_FILES; x++) this.drawGridPiece(this.squares[x][y]);
  }

  drawGridPiece(square) { //console.log(square);
    let scale = this.interpolated ? .5 : .75;
    if (!square.missing && square.piece !== 0) {
      //let w2 = square.canvas.width/2, w4 = square.canvas.width/4, h2 = square.canvas.height/2, h4 = square.canvas.height/3;
      let x = square.canvas.width * ((1-scale)/2); let y = square.canvas.width * ((1-scale)/2);
      let w = square.canvas.width * scale;
      if (square.piece > 0) square.ctx.drawImage(this.piece_imgs[square.piece-1].white,x,y,w,w); //w4,h4,w2,h2);
      else square.ctx.drawImage(this.piece_imgs[-square.piece-1].black,x,y,w,w,); //w4,h4,w2,h2);
    }
  }

  drawGridControlNumbers(puzzle_squares) {
    for (let y=0; y<ZugBoard.MAX_RANKS; y++) {
      for (let x=0; x<ZugBoard.MAX_FILES; x++) {
        let corner_width = (this.squares[x][y].canvas.width/6);
        this.squares[x][y].ctx.font = 'bold ' + corner_width + 'px fixedsys';
        if (this.squares[x][y].control !== puzzle_squares[x][y].control) {
          if (this.verbose) {
            this.squares[x][y].ctx.fillStyle = "red";
            this.squares[x][y].ctx.fillText(this.squares[x][y].control,8,corner_width);
          }
          if (this.interpolated) {
            this.squares[x][y].ctx.fillStyle = "darkgrey";
          }
          else {
            let rect_dim = corner_width * 1.5;
            this.squares[x][y].ctx.fillStyle = "#000000";
            this.squares[x][y].ctx.fillRect(this.squares[x][y].canvas.width - rect_dim,0,rect_dim,rect_dim);
            this.squares[x][y].ctx.fillStyle = "#DD5555";
          }
          this.squares[x][y].ctx.fillText(puzzle_squares[x][y].control,this.squares[x][y].canvas.width-corner_width,corner_width);
        }
      }
    }
  }

  drawSquares() {
    for (let y = 0; y < ZugBoard.MAX_RANKS; y++) {
      for (let x = 0; x < ZugBoard.MAX_FILES; x++) {
        this.squares[x][y].ctx.drawImage(this.squares[x][y].shade === ZugBoard.LIGHT ? this.img_light_sqr : this.img_dark_sqr,
          0,0,this.squares[x][y].canvas.width,this.squares[x][y].canvas.width);
      }
    }
  }

  drawInterpolatedSquares() {
    let pix_array = this.getInterpolatedBoard(this.squares[0][0].canvas.width,this.squares[0][0].canvas.height);
    for (let y = 0; y < ZugBoard.MAX_RANKS; y++) {
      for (let x = 0; x < ZugBoard.MAX_FILES; x++) {
        this.squares[x][y].ctx.putImageData(this.getInterpolatedSquare(x,y,this.squares[x][y].canvas.width,this.squares[x][y].canvas.height,pix_array),0,0);
      }
    }
  }

  getInterpolatedBoard(square_width,square_height) {
    let edge_col = this.board_background_color;
    let padded_board_width = square_width * (ZugBoard.MAX_FILES+2), padded_board_height = square_height * (ZugBoard.MAX_RANKS+2);
    let pix_array = [];
    for (let w=0; w < (padded_board_width); w++) {
      pix_array[w] = [];
      for (let h=0; h < (padded_board_height); h++) {
        pix_array[w][h] = [];
        for (let i = 0; i < 3; i++) pix_array[w][h][i] = 0;
      }
    }
    let rect = { left: 0, top: 0, right: ZugBoard.MAX_FILES-1, bottom: ZugBoard.MAX_RANKS-1 };
    let x_center = Math.floor(square_width/2), y_center = Math.floor(square_height/2);
    for (let nx = -1; nx < 8; nx++) {
      for (let ny = -1; ny < 8; ny++) {
        let sqr_x = Math.floor(((nx + 1) * square_width) + x_center);
        let sqr_y = Math.floor(((ny + 1) * square_height) + y_center);
        let c1 = ZugBoard.inBounds(nx, ny, rect) ? rgb2array(this.squares[nx][ny].color) : edge_col;
        let c2 = ZugBoard.inBounds(nx + 1, ny, rect) ? rgb2array(this.squares[nx + 1][ny].color) : edge_col;
        let c3 = ZugBoard.inBounds(nx, ny + 1, rect) ? rgb2array(this.squares[nx][ny + 1].color) : edge_col;
        let c4 = ZugBoard.inBounds(nx + 1, ny + 1, rect) ? rgb2array(this.squares[nx + 1][ny + 1].color) : edge_col;
        for (let i = 0; i < 3; i++) {
          for (let lerp_x = 0; lerp_x < square_width; lerp_x++) {
            let v = lerp_x / square_width, x = sqr_x + lerp_x, bottom_y = sqr_y + square_height;
            //interpolate right
            pix_array[x][sqr_y][i] = Math.floor(ZugBoard.lerp(v, c1[i], c2[i]));
            //interpolate right and below
            pix_array[x][bottom_y][i] = Math.floor(ZugBoard.lerp(v, c3[i], c4[i]));
            //interpolate down
            for (let lerp_y = 0; lerp_y < square_height; lerp_y++) {
              let y = sqr_y + lerp_y; v = lerp_y / square_height;
              pix_array[x][y][i] = Math.floor(ZugBoard.lerp(v, pix_array[x][sqr_y][i], pix_array[x][bottom_y][i]));
            }
          }
        }
      }
    }
    return pix_array;
  }

  getInterpolatedSquare(file,rank,square_width,square_height,pix_array) {
    let img_data = new ImageData(square_width,square_height); let pixels = img_data.data;
    let array_x = square_width + (file * square_width), array_y = square_height + (rank * square_height); //pix_array is 10x10
    for (let py = 0; py < square_height; py++) {
      for (let px = 0; px < square_width; px++) {
        ZugBoard.setPixel((py * img_data.width + px) * 4,pixels,pix_array[array_x + px][array_y + py]);
      }
    }
    return img_data;
  }

  colorCycle() {
    for (let y=0; y<ZugBoard.MAX_RANKS; y++) for (let x=0; x<ZugBoard.MAX_FILES; x++) ZugBoard.squareCycle(this.squares[x][y].canvas,this.squares[x][y].ctx);
  }

  static setPixel(offset,pixels,pix_array) {
    pixels[offset] = pix_array[0]; pixels[offset + 1] = pix_array[1]; pixels[offset + 2] = pix_array[2];
    pixels[offset + 3] = 255;
  }

  static lerp(v, start, end) {
    return (1 - v) * start + v * end;
  }

  static inBounds(x,y,rect) {
    return (x >= rect.left && y >= rect.top && x <= rect.right && y <= rect.bottom);
  }

  //TODO: add to Square
  static squareCycle(canvas,ctx) {
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

  static getColor(square) {
    //return getSingleColor(square,board_background_color);
    return this.getTwoColor(square,this.RED,this.GREEN,this.BLUE); //return getTwoColor(square,GREEN,RED,BLUE);
  }

  static getSingleColor(square,color) {
    let c = .5 + ((square.control * (1 / MAX_CONTROL))/2);
    let hsv_color = rgbToHsv(color[0],color[1],color[2]);
    let rgb_color = hsvToRgb(hsv_color[0],hsv_color[1],c); //hsv_color[2]); //console.log(c + "," + JSON.stringify(hsv_color) + "," + rgb_color);
    return rgb(rgb_color[0],rgb_color[1],rgb_color[2]);
  }

  static getTwoColor(square,blackColor,voidColor,whiteColor) {
    let color_matrix = [];
    let control_grad = 256 / MAX_CONTROL;
    let c = square.control * control_grad;

    if (c < 0) {
      color_matrix[blackColor] = Math.abs(c); color_matrix[voidColor] = 0; color_matrix[whiteColor] = 0;
    }
    else { //} if (c > 0) {
      color_matrix[blackColor] = 0; color_matrix[voidColor] = 0; color_matrix[whiteColor] = Math.abs(c);
    }
    //else { color_matrix = board_background_color; }
    return rgb(color_matrix[0],color_matrix[1],color_matrix[2]);
  }

  static getCoords(id) {
    return { x: id % this.MAX_FILES, y: Math.floor(id / this.MAX_RANKS) };
  }

  static calcBoard(squares) {
    for (let y = 0; y < this.MAX_RANKS; y++) {
      for (let x = 0; x < this.MAX_FILES; x++) {
        squares[x][y].control = getControl(x,y,squares,false);
        squares[x][y].color = ZugBoard.getColor(squares[x][y]);
      }
    }
  }

  static setFEN(squares,fen) { //console.log("FEN: " + fen);
    for (let y=0; y<ZugBoard.MAX_RANKS; y++) for (let x=0; x<ZugBoard.MAX_FILES; x++) squares[x][y].piece = 0;
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
}
