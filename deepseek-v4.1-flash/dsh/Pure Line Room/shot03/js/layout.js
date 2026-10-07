/* =========================================================================
   Pure Line Room — layout.js
   One authoritative map of the room, in centimetres, so that every object
   module agrees about where things are and nothing interpenetrates.
   X: left(-) .. right(+)   Y: floor 0 .. ceiling   Z: back wall(-) .. front(+)
   ========================================================================= */
(function (root) {
  'use strict';
  var PLR = (root.PLR = root.PLR || {});

  var L = {
    /* the shell. The room is deliberately a little wider than deep so the back
       wall carries most of the furniture, with the side walls reading as
       foreshortened planes at the edges of the view. */
    x0: -240, x1: 240,
    y0: 0, y1: 286,
    z0: -230, z1: 470,
    eye: 140,

    /* Camera framing. The near field at the home position is narrow, so the
       home camera sits well back near the front wall with a wide lens. That
       keeps the back wall and both side walls in the frame; furniture is then
       kept toward the back and middle of the room so it stays on the plate. */
    camera: {
      focal: 392,
      home: [0, 150, 430],
      pitch: -0.185,
      center: [0, 126, -10],
    },

    /* ---- back wall (z = z0), left to right ---- */
    bookshelf: { x: -178, w: 92, d: 30, h: 164 },
    desk: { x: -38, w: 132, d: 56, h: 74 },
    chair: { x: -26, z: 92 },
    window: { cx: 146, w: 152, y0: 92, y1: 234 },
    clock: { cx: 4, cy: 230, r: 18 },

    /* ---- left wall (x = x0) ---- */
    /* The door sits toward the BACK of the left wall so it is inside the view
       rather than behind the camera's shoulder; the sideboard fills the gap
       between the door and the back corner. */
    door: { cz: 24, w: 92, h: 200 },
    sideboard: { cz: -136, d: 86, h: 86 },
    switchPlate: { cz: 104, cy: 126 },

    /* ---- right wall (x = x1) ---- */
    sofa: { x: 328, cz: 120, len: 190, h: 78 },
    painting: { cz: -60, cy: 168, w: 164, h: 116 },

    /* ---- floor / centre ---- */
    /* Rug, table and record player form one lounge group set out from the right
       wall and well back from the camera, so the group reads whole. */
    rug: { x: 44, z: 140, w: 224, d: 210 },
    coffeeTable: { x: 126, z: 146, w: 114, d: 64, h: 40 },
    recordPlayer: { x: 126, y: 40, z: 146, w: 56, d: 46, h: 15 },

    /* ---- ceiling ---- */
    fan: { x: -12, y: 286, z: 40 },
    chime: { x: -150, y: 286, z: -150 },
    pendant: { x: 104, z: 120 },

    /* wall art near the desk */
    smallFrame: { x: -38, y: 208, w: 52, h: 36 },
  };

  /* desk top surface height, used by everything that stands on the desk */
  L.deskTop = L.desk.h;
  L.counterTop = L.sideboard.h;
  L.sofaSeat = 42;

  /* Where the objects on the desk stand (world x, z). The desk's top face is
     the rectangle x ∈ [-104, 36] (centred on L.desk.x, depth L.desk.d from the
     back wall), so everything here sits comfortably on it. */
  L.deskItems = {
    lamp: [-92, -206],
    cup: [-16, -200],
    globe: [-66, -184],
    books: [10, -190],
  };
  L.bookStack = [10, -190];
  L.deskRear = L.z0 + 10;

  PLR.layout = L;
})(typeof window !== 'undefined' ? window : globalThis);
