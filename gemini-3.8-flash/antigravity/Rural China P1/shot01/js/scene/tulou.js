// js/scene/tulou.js
// 宏伟客家土楼核心建筑体素生成器 - 大尺度、多层环形、深邃天井与精细木构

import { PALETTE, COLOR_VARS } from '../voxel/palette.js';

export function buildTulou(voxelScene) {
  const cx = 0;
  const cz = 0;

  // 升级后的宏伟尺度定义
  const R_OUTER = 22.0;         // 外径 44 体素单位 (宏伟壮观)
  const R_WALL_INNER = 19.0;    // 外墙内径，墙厚 3 体素单位 (坚实厚重生土夯筑)
  const R_ROOM_DIV = 14.5;      // 居室与环廊分界
  const R_COURT = 11.0;         // 中央开敞大天井半径 (直径 22 体素单位，通透开阔)
  const R_ROOF_OUTER = 25.0;    // 屋顶外挑檐 (外挑 3 体素，气势恢宏)
  const R_ROOF_RIDGE = 16.0;    // 屋顶正脊半径
  const R_ROOF_INNER = 10.0;    // 屋顶内挑檐 (遮盖四层内走廊)

  // 垂直层高定义 (4 层壮丽客家围楼结构)
  // F1: 0..3 (高4)
  // F2: 4..7 (高4)
  // F3: 8..11 (高4)
  // F4: 12..15 (高4)
  // Roof: 15..19 (高4，总高 19 体素)
  const Y_ROOF_EAVES_OUT = 15;
  const Y_ROOF_RIDGE = 19;
  const Y_ROOF_EAVES_IN = 16;

  function hash(x, y, z) {
    const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return s - Math.floor(s);
  }

  // ==========================================
  // 1. 厚重夯土外墙 (OuterWall) - 4层生土夯筑、岁月斑驳
  // ==========================================
  const rMaxCeil = Math.ceil(R_OUTER + 1);

  for (let y = 0; y <= 15; y++) {
    for (let dz = -rMaxCeil; dz <= rMaxCeil; dz++) {
      for (let dx = -rMaxCeil; dx <= rMaxCeil; dx++) {
        const dist = Math.sqrt(dx * dx + dz * dz);
        const angle = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;

        // 手工生土夯筑的不规则微凸起
        const bump = (hash(dx, y, dz) - 0.5) * 0.4;
        const currentRout = R_OUTER + bump;

        if (dist >= R_WALL_INNER && dist <= currentRout) {
          // 南向主大门通道避让 (门洞 X: -2..2, Z: 17..23, Y: 0..4)
          if (dz > 16 && Math.abs(dx) <= 2 && y <= 4) {
            continue;
          }

          // 2层：狭窄防御箭窗/望孔 (每隔 15 度，避开南门正上方)
          if ((y === 6) && (Math.abs(angle % 15) < 2.0) && dz < 18) {
            continue;
          }

          // 3层：采光通风木窗 (每隔 12 度)
          if ((y === 9 || y === 10) && (Math.abs(angle % 12) < 2.2) && dz < 18) {
            continue;
          }

          // 4层：上层景观与眺望木窗 (每隔 12 度)
          if ((y === 13 || y === 14) && (Math.abs(angle % 12) < 2.2) && dz < 18) {
            continue;
          }

          // 夯土分层色彩与自然风化质感
          let earthColor = PALETTE.EARTH_WARM;
          const hVal = hash(dx, y * 2.5, dz);

          // 水平夯筑土层 (每两层一交替)
          const layerIdx = Math.floor(y / 2);
          if (layerIdx % 2 === 0) {
            earthColor = hVal > 0.4 ? PALETTE.EARTH_OCHRE : PALETTE.EARTH_WARM;
          } else {
            earthColor = hVal > 0.4 ? PALETTE.EARTH_DARK : PALETTE.EARTH_GREY_BROWN;
          }

          // 墙基水汽潮湿青苔斑
          if (y === 0 && hVal > 0.5) {
            earthColor = PALETTE.EARTH_MOSSY;
          }
          // 檐下深色阴影沉淀
          if (y === 15 && hVal > 0.3) {
            earthColor = PALETTE.EARTH_DEEP;
          }

          voxelScene.set(cx + dx, y, cz + dz, earthColor, 'Tulou/OuterWall', 'RammedEarth_Block');
        }
      }
    }
  }

  // ==========================================
  // 2. 南向主入口大门 (Entrance) - 气势磅礴的花岗岩台门
  // ==========================================
  // 花岗岩厚重门框 (X: -3..3, Y: 0..5, Z: 20..22)
  for (let y = 0; y <= 5; y++) {
    for (let x = -3; x <= 3; x++) {
      if (Math.abs(x) === 3 || y === 5) {
        voxelScene.set(cx + x, y, 22, PALETTE.STONE_LIGHT, 'Tulou/Entrance', 'Stone_DoorFrame');
        voxelScene.set(cx + x, y, 21, PALETTE.STONE_MID, 'Tulou/Entrance', 'Stone_DoorFrame');
        voxelScene.set(cx + x, y, 20, PALETTE.STONE_MID, 'Tulou/Entrance', 'Stone_DoorFrame');
      }
    }
  }

  // 厚重双开红黑大木门 (厚 1 体素，配铜门钉)
  for (let y = 0; y <= 4; y++) {
    for (let x of [-2, -1, 1, 2]) {
      voxelScene.set(cx + x, y, 19, PALETTE.TIMBER_DARK, 'Tulou/Entrance', 'Wooden_Gate');
      if (y === 2 || y === 3) {
        if (Math.abs(x) === 1) {
          voxelScene.set(cx + x, y, 19, PALETTE.LANTERN_GOLD, 'Tulou/Entrance', 'Gate_Stud');
        }
      }
    }
  }

  // 门楣上方木雕金漆牌匾 "承启楼 / 客家土楼"
  for (let x = -2; x <= 2; x++) {
    voxelScene.set(cx + x, 5, 23, PALETTE.TIMBER_LACQUER, 'Tulou/Entrance', 'Plaque_Board');
    if (Math.abs(x) <= 1) {
      voxelScene.set(cx + x, 5, 23, PALETTE.PLAQUE_GOLD, 'Tulou/Entrance', 'Plaque_Gold_Text');
    }
  }

  // 门前汉白玉/花岗岩进门石台阶 (向南外伸)
  for (let x = -3; x <= 3; x++) {
    voxelScene.set(cx + x, 0, 23, PALETTE.STONE_LIGHT, 'Tulou/Entrance', 'Entrance_Step_High');
    voxelScene.set(cx + x, -0.5, 24, PALETTE.STONE_MID, 'Tulou/Entrance', 'Entrance_Step_Mid');
    voxelScene.set(cx + x, -1, 25, PALETTE.STONE_DARK, 'Tulou/Entrance', 'Entrance_Step_Low');
  }

  // 门前一对石鼓/抱鼓石与高挂红灯笼
  for (let sx of [-4, 4]) {
    // 抱鼓石
    voxelScene.set(cx + sx, 0, 22, PALETTE.STONE_LIGHT, 'Tulou/Entrance', 'Drum_Stone');
    voxelScene.set(cx + sx, 1, 22, PALETTE.STONE_MID, 'Tulou/Entrance', 'Drum_Stone');

    // 木制挂灯托梁
    voxelScene.set(cx + sx, 4, 22, PALETTE.TIMBER_MID, 'Tulou/Entrance', 'Lantern_Bracket');
    voxelScene.set(cx + sx, 3, 22, PALETTE.LANTERN_RED, 'Tulou/Entrance', 'Red_Lantern');
    voxelScene.set(cx + sx, 2, 22, PALETTE.LANTERN_GOLD, 'Tulou/Entrance', 'Lantern_Tassel');
  }

  // ==========================================
  // 3. 门窗系统 (Doors & Windows)
  // ==========================================
  // 2层：防御性外墙箭窗
  for (let a = 0; a < 360; a += 15) {
    if (a > 155 && a < 205) continue;
    const rad = a * Math.PI / 180;
    const wx = Math.round(cx + Math.sin(rad) * R_OUTER);
    const wz = Math.round(cz + Math.cos(rad) * R_OUTER);
    voxelScene.set(wx, 6, wz, PALETTE.TIMBER_DARK, 'Tulou/Windows', 'F2_Defense_Slit');
  }

  // 3层：深色外墙木百叶窗
  for (let a = 0; a < 360; a += 12) {
    if (a > 160 && a < 200) continue;
    const rad = a * Math.PI / 180;
    const wx = Math.round(cx + Math.sin(rad) * R_OUTER);
    const wz = Math.round(cz + Math.cos(rad) * R_OUTER);
    voxelScene.set(wx, 8, wz, PALETTE.TIMBER_OLD, 'Tulou/Windows', 'F3_Window_Sill');
    voxelScene.set(wx, 9, wz, PALETTE.TIMBER_MID, 'Tulou/Windows', 'F3_Window_Frame');
    voxelScene.set(wx, 10, wz, PALETTE.TIMBER_OLD, 'Tulou/Windows', 'F3_Window_Lintel');
  }

  // 4层：高层外挑木窗与托木
  for (let a = 0; a < 360; a += 12) {
    if (a > 165 && a < 195) continue;
    const rad = a * Math.PI / 180;
    const wx = Math.round(cx + Math.sin(rad) * R_OUTER);
    const wz = Math.round(cz + Math.cos(rad) * R_OUTER);
    voxelScene.set(wx, 12, wz, PALETTE.TIMBER_OLD, 'Tulou/Windows', 'F4_Window_Sill');
    voxelScene.set(wx, 13, wz, PALETTE.TIMBER_MID, 'Tulou/Windows', 'F4_Window_Shutter');
    voxelScene.set(wx, 14, wz, PALETTE.TIMBER_OLD, 'Tulou/Windows', 'F4_Window_Lintel');
  }

  // 内部朝向天井的门窗 (各层单元格门扇)
  for (let a = 5; a < 360; a += 10) {
    const rad = a * Math.PI / 180;
    const rx = Math.round(cx + Math.sin(rad) * R_ROOM_DIV);
    const rz = Math.round(cz + Math.cos(rad) * R_ROOM_DIV);

    // 1层内门
    voxelScene.set(rx, 1, rz, PALETTE.TIMBER_DARK, 'Tulou/Doors', 'F1_RoomDoor');
    voxelScene.set(rx, 2, rz, PALETTE.TIMBER_MID, 'Tulou/Doors', 'F1_DoorTransom');

    // 2层内门
    voxelScene.set(rx, 5, rz, PALETTE.TIMBER_DARK, 'Tulou/Doors', 'F2_RoomDoor');

    // 3层内门
    voxelScene.set(rx, 9, rz, PALETTE.TIMBER_DARK, 'Tulou/Doors', 'F3_RoomDoor');

    // 4层内门
    voxelScene.set(rx, 13, rz, PALETTE.TIMBER_DARK, 'Tulou/Doors', 'F4_RoomDoor');
  }

  // ==========================================
  // 4. 楼板系统 (Floors)
  // ==========================================
  // 1层石铺底坪
  voxelScene.fillRing(cx, cz, R_COURT, R_WALL_INNER + 0.5, 0, 0, (x, y, z) => {
    return (x + z) % 2 === 0 ? PALETTE.STONE_DARK : PALETTE.STONE_PEBBLE;
  }, 'Tulou/Floors', 'F1_Stone_Floor');

  // 2层、3层、4层木楼板 (木板从外墙内侧延伸至内走廊边缘)
  const floorHeights = [4, 8, 12];
  for (const fy of floorHeights) {
    voxelScene.fillRing(cx, cz, R_COURT + 0.5, R_WALL_INNER, fy, fy, (x, y, z) => {
      return (x + z) % 2 === 0 ? PALETTE.TIMBER_FLOOR : PALETTE.TIMBER_MID;
    }, 'Tulou/Floors', `Floor_${fy}_TimberDeck`);
  }

  // ==========================================
  // 5. 木构环廊与立柱梁枋 (WoodenCorridor)
  // ==========================================
  // 36根通高环形木柱，环绕大天井内侧排布
  const NUM_COLUMNS = 36;
  for (let i = 0; i < NUM_COLUMNS; i++) {
    const angle = (i / NUM_COLUMNS) * Math.PI * 2;
    const colX = Math.round(cx + Math.sin(angle) * (R_COURT + 0.8));
    const colZ = Math.round(cz + Math.cos(angle) * (R_COURT + 0.8));

    // 从 1层 通到 4层 顶部的木立柱
    for (let y = 1; y <= 15; y++) {
      voxelScene.set(colX, y, colZ, PALETTE.TIMBER_DARK, 'Tulou/WoodenCorridor', 'Pillar_Column');
    }

    // 各层柱头横梁与牛腿雀替
    voxelScene.set(colX, 4, colZ, PALETTE.TIMBER_MID, 'Tulou/WoodenCorridor', 'Crossbeam_F2');
    voxelScene.set(colX, 8, colZ, PALETTE.TIMBER_MID, 'Tulou/WoodenCorridor', 'Crossbeam_F3');
    voxelScene.set(colX, 12, colZ, PALETTE.TIMBER_MID, 'Tulou/WoodenCorridor', 'Crossbeam_F4');
    voxelScene.set(colX, 15, colZ, PALETTE.TIMBER_MID, 'Tulou/WoodenCorridor', 'Eaves_Bracket_Top');
  }

  // 内部放射状木隔墙 (将各层环廊分隔为几十间生活居室)
  const NUM_PARTITIONS = 24;
  for (let i = 0; i < NUM_PARTITIONS; i++) {
    const angle = (i / NUM_PARTITIONS) * Math.PI * 2;
    for (let r = R_ROOM_DIV; r <= R_WALL_INNER; r += 0.8) {
      const px = Math.round(cx + Math.sin(angle) * r);
      const pz = Math.round(cz + Math.cos(angle) * r);
      for (let y of [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15]) {
        voxelScene.set(px, y, pz, PALETTE.TIMBER_MID, 'Tulou/WoodenCorridor', 'Radial_Partition');
      }
    }
  }

  // 2层、3层、4层环形木制护栏 (木栏杆与望柱)
  const railingCeil = Math.ceil(R_COURT + 1.2);
  for (let dz = -railingCeil; dz <= railingCeil; dz++) {
    for (let dx = -railingCeil; dx <= railingCeil; dx++) {
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist >= R_COURT + 0.3 && dist <= R_COURT + 1.1) {
        // 2层木栏杆 (Y=5)
        voxelScene.set(cx + dx, 5, cz + dz, PALETTE.TIMBER_MID, 'Tulou/WoodenCorridor', 'Railing_F2');
        // 3层木栏杆 (Y=9)
        voxelScene.set(cx + dx, 9, cz + dz, PALETTE.TIMBER_MID, 'Tulou/WoodenCorridor', 'Railing_F3');
        // 4层木栏杆 (Y=13)
        voxelScene.set(cx + dx, 13, cz + dz, PALETTE.TIMBER_MID, 'Tulou/WoodenCorridor', 'Railing_F4');
      }
    }
  }

  // 环廊上悬挂的节日红灯笼 (点亮聚居生活)
  for (let a of [30, 90, 150, 210, 270, 330]) {
    const rad = a * Math.PI / 180;
    const lx = Math.round(cx + Math.sin(rad) * (R_COURT + 1.4));
    const lz = Math.round(cz + Math.cos(rad) * (R_COURT + 1.4));
    voxelScene.set(lx, 7, lz, PALETTE.LANTERN_RED, 'Tulou/WoodenCorridor', 'Corridor_Lantern_F2');
    voxelScene.set(lx, 11, lz, PALETTE.LANTERN_RED, 'Tulou/WoodenCorridor', 'Corridor_Lantern_F3');
    voxelScene.set(lx, 15, lz, PALETTE.LANTERN_RED, 'Tulou/WoodenCorridor', 'Corridor_Lantern_F4');
  }

  // ==========================================
  // 6. 木质楼梯 (Staircases)
  // ==========================================
  // 四大象限均布 4 座木质步梯，连接 1F -> 2F -> 3F -> 4F
  const STAIR_ANGLES = [45, 135, 225, 315];
  for (const stA of STAIR_ANGLES) {
    const rad = stA * Math.PI / 180;
    for (let step = 0; step < 4; step++) {
      const stepAngle = rad + (step * 0.05);
      const stX = Math.round(cx + Math.sin(stepAngle) * (R_ROOM_DIV - 0.5));
      const stZ = Math.round(cz + Math.cos(stepAngle) * (R_ROOM_DIV - 0.5));

      // 1F -> 2F
      voxelScene.set(stX, 1 + step, stZ, PALETTE.TIMBER_FLOOR, 'Tulou/Staircases', 'Stair_Step_F1_F2');
      voxelScene.set(stX, 2 + step, stZ, PALETTE.TIMBER_MID, 'Tulou/Staircases', 'Stair_Handrail');

      // 2F -> 3F
      voxelScene.set(stX, 5 + step, stZ, PALETTE.TIMBER_FLOOR, 'Tulou/Staircases', 'Stair_Step_F2_F3');

      // 3F -> 4F
      voxelScene.set(stX, 9 + step, stZ, PALETTE.TIMBER_FLOOR, 'Tulou/Staircases', 'Stair_Step_F3_F4');
    }
  }

  // ==========================================
  // 7. 宏阔中央天井 (Courtyard) - 祖堂、阴阳双古井、石铺广场
  // ==========================================
  // 天井地面铺装 (同心青石条带与水磨石花纹)
  const courtMax = Math.ceil(R_COURT);
  for (let dz = -courtMax; dz <= courtMax; dz++) {
    for (let dx = -courtMax; dx <= courtMax; dx++) {
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= R_COURT) {
        let paveCol = PALETTE.STONE_MID;
        // 同心环纹
        if (Math.abs(dist - 8.0) < 0.6 || Math.abs(dist - 5.0) < 0.6) {
          paveCol = PALETTE.STONE_LIGHT;
        } else if ((dx + dz) % 3 === 0) {
          paveCol = PALETTE.STONE_DARK;
        }
        // 外围檐下排水环沟 (明沟散水)
        if (dist >= R_COURT - 0.9) {
          paveCol = PALETTE.STONE_WELL;
        }
        voxelScene.set(cx + dx, 0, cz + dz, paveCol, 'Tulou/Courtyard', 'Courtyard_Paving');
      }
    }
  }

  // 天井中心：客家土楼核心建筑——中心单层祖堂 (Ancestral Hall / 祖堂)
  // 半径 3.8 的微型同心单层木构小殿堂，中式飞檐歇山顶
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d <= 3.8) {
        // 祖堂基台
        voxelScene.set(cx + dx, 0.5, cz + dz, PALETTE.STONE_LIGHT, 'Tulou/Courtyard', 'Hall_Plinth');

        // 四角木柱与梁架 (高 3 体素)
        if ((Math.abs(dx) === 3 && Math.abs(dz) <= 2) || (Math.abs(dz) === 3 && Math.abs(dx) <= 2)) {
          // 南侧正面留出大门敞开通道
          if (dz > 1 && Math.abs(dx) <= 1) {
            // 大门留空通道
          } else {
            voxelScene.set(cx + dx, 1, cz + dz, PALETTE.TIMBER_DARK, 'Tulou/Courtyard', 'Hall_Wall');
            voxelScene.set(cx + dx, 2, cz + dz, PALETTE.TIMBER_MID, 'Tulou/Courtyard', 'Hall_Lattice');
          }
        }

        // 祖堂歇山小坡屋顶 (Y=3..4)
        if (d <= 4.2) {
          const roofY = d <= 1.8 ? 4 : 3;
          voxelScene.set(cx + dx, roofY, cz + dz, PALETTE.ROOF_CHARCOAL, 'Tulou/Courtyard', 'Hall_Roof_Tile');
          if (d <= 1.0) {
            voxelScene.set(cx + dx, 4.5, cz + dz, PALETTE.ROOF_DARK_RIDGE, 'Tulou/Courtyard', 'Hall_Roof_Ridge');
          }
        }
      }
    }
  }

  // 经典客家土楼“阴阳双古井” (双石井对称布置于祖堂左右翼)
  const wells = [
    { wx: cx - 6, wz: cz, name: "Yang_Well" },
    { wx: cx + 6, wz: cz, name: "Yin_Well" }
  ];

  for (const w of wells) {
    // 井台与八角凸起井圈
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) {
          voxelScene.set(w.wx, 0, w.wz, PALETTE.WATER_WELL, 'Tulou/Courtyard', `${w.name}_Water`);
        } else {
          voxelScene.set(w.wx + dx, 0, w.wz + dz, PALETTE.STONE_LIGHT, 'Tulou/Courtyard', `${w.name}_Base`);
          voxelScene.set(w.wx + dx, 1, w.wz + dz, PALETTE.STONE_WELL, 'Tulou/Courtyard', `${w.name}_Curb`);
        }
      }
    }
    // 井架轱辘木柱与木桶
    voxelScene.set(w.wx - 1, 2, w.wz, PALETTE.TIMBER_DARK, 'Tulou/Courtyard', `${w.name}_Post`);
    voxelScene.set(w.wx + 1, 2, w.wz, PALETTE.TIMBER_DARK, 'Tulou/Courtyard', `${w.name}_Post`);
    voxelScene.set(w.wx, 2, w.wz, PALETTE.TIMBER_MID, 'Tulou/Courtyard', `${w.name}_Beam`);
    voxelScene.set(w.wx, 1, w.wz - 1, PALETTE.TIMBER_FLOOR, 'Tulou/Courtyard', `${w.name}_Bucket`);
  }

  // 天井器物：陶土防火大水缸 (分布在四角)
  const vatCoords = [
    [cx - 5, cz - 5], [cx + 5, cz - 5],
    [cx - 5, cz + 5], [cx + 5, cz + 5]
  ];
  for (const [vx, vz] of vatCoords) {
    voxelScene.set(vx, 0, vz, PALETTE.STONE_DARK, 'Tulou/Courtyard', 'Vat_Base');
    voxelScene.set(vx, 1, vz, PALETTE.TIMBER_LACQUER, 'Tulou/Courtyard', 'Fire_Water_Vat');
    voxelScene.set(vx, 1.2, vz, PALETTE.WATER_WELL, 'Tulou/Courtyard', 'Vat_Water');
  }

  // 石桌石凳品茶组
  const tblX = cx - 2;
  const tblZ = cz + 6;
  voxelScene.set(tblX, 0.5, tblZ, PALETTE.STONE_MID, 'Tulou/Courtyard', 'Stone_Table');
  voxelScene.set(tblX, 1, tblZ, PALETTE.STONE_LIGHT, 'Tulou/Courtyard', 'Stone_Table_Top');
  voxelScene.set(tblX - 1, 0, tblZ, PALETTE.STONE_DARK, 'Tulou/Courtyard', 'Stone_Stool');
  voxelScene.set(tblX + 1, 0, tblZ, PALETTE.STONE_DARK, 'Tulou/Courtyard', 'Stone_Stool');
  voxelScene.set(tblX, 0, tblZ - 1, PALETTE.STONE_DARK, 'Tulou/Courtyard', 'Stone_Stool');
  voxelScene.set(tblX, 0, tblZ + 1, PALETTE.STONE_DARK, 'Tulou/Courtyard', 'Stone_Stool');

  // 晒秋竹匾组 (晾晒金黄稻谷与鲜红辣椒)
  voxelScene.set(cx + 2, 0.5, cz + 6, PALETTE.HAY_GOLD, 'Tulou/Courtyard', 'Drying_Grains');
  voxelScene.set(cx + 4, 0.5, cz + 6, PALETTE.LANTERN_RED, 'Tulou/Courtyard', 'Drying_Peppers');

  // 廊下规整堆放的柴火垛
  for (let i = 0; i < 4; i++) {
    voxelScene.set(cx - 8 + i, 0, cz - 6, PALETTE.FIREWOOD_LOG, 'Tulou/Courtyard', 'Courtyard_Firewood');
    voxelScene.set(cx - 8 + i, 1, cz - 6, PALETTE.FIREWOOD_BARK, 'Tulou/Courtyard', 'Courtyard_Firewood');
  }

  // ==========================================
  // 8. 传统中式瓦屋顶 (Roof) - 宏大气势双坡环形飞檐
  // ==========================================
  // 从外挑檐 R_ROOF_OUTER (25.0, Y=15) 爬升至主正脊 R_ROOF_RIDGE (16.0, Y=19)
  // 再向天井内檐 R_ROOF_INNER (10.0, Y=16) 下倾
  const rRoofMax = Math.ceil(R_ROOF_OUTER + 1);

  for (let dz = -rRoofMax; dz <= rRoofMax; dz++) {
    for (let dx = -rRoofMax; dx <= rRoofMax; dx++) {
      const dist = Math.sqrt(dx * dx + dz * dz);
      const angle = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;

      if (dist >= R_ROOF_INNER && dist <= R_ROOF_OUTER) {
        let roofY;
        let isRidge = false;
        let isEaves = false;

        if (dist >= R_ROOF_RIDGE) {
          // 外坡：从正脊 (16.0, Y=19) 向下到外挑檐 (25.0, Y=15)
          const t = (dist - R_ROOF_RIDGE) / (R_ROOF_OUTER - R_ROOF_RIDGE);
          roofY = Math.round(Y_ROOF_RIDGE - t * (Y_ROOF_RIDGE - Y_ROOF_EAVES_OUT));
          if (dist > R_ROOF_OUTER - 0.7) isEaves = true;
        } else {
          // 内坡：从正脊 (16.0, Y=19) 向下到内挑檐 (10.0, Y=16)
          const t = (R_ROOF_RIDGE - dist) / (R_ROOF_RIDGE - R_ROOF_INNER);
          roofY = Math.round(Y_ROOF_RIDGE - t * (Y_ROOF_RIDGE - Y_ROOF_EAVES_IN));
          if (dist < R_ROOF_INNER + 0.7) isEaves = true;
        }

        if (Math.abs(dist - R_ROOF_RIDGE) < 0.7) {
          isRidge = true;
        }

        // 瓦垄线：每隔 4.5 度一条凸起瓦垄
        const isTileRib = Math.abs(angle % 4.5) < 1.0;

        let tileColor = PALETTE.ROOF_CHARCOAL;
        const hVal = hash(dx, roofY, dz);

        if (isRidge) {
          tileColor = PALETTE.ROOF_DARK_RIDGE;
          // 屋脊叠高增强传统正脊造型
          voxelScene.set(cx + dx, roofY + 1, cz + dz, PALETTE.ROOF_DARK_RIDGE, 'Tulou/Roof', 'Roof_Ridge_Cap');
        } else if (isEaves) {
          tileColor = PALETTE.ROOF_EAVES;
        } else if (isTileRib) {
          tileColor = PALETTE.ROOF_SLATE;
        } else {
          tileColor = hVal > 0.4 ? PALETTE.ROOF_CHARCOAL : PALETTE.ROOF_SLATE;
        }

        // 阴面瓦面青苔微斑 (北向与东北向)
        if (dz < -8 && hVal > 0.6) {
          tileColor = PALETTE.ROOF_MOSS;
        }

        voxelScene.set(cx + dx, roofY, cz + dz, tileColor, 'Tulou/Roof', 'Roof_Tile');

        // 檐口外挑处下托木橼支撑
        if (isEaves) {
          voxelScene.set(cx + dx, roofY - 1, cz + dz, PALETTE.TIMBER_MID, 'Tulou/Roof', 'Eaves_Rafter');
        }
      }
    }
  }

  console.log("Grand Hakka Tulou architecture voxels generated.");
}
