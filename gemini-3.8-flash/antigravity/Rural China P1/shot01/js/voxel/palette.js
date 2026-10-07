// js/voxel/palette.js
// 东方乡土建筑低饱和色彩表 - 客家土楼专属色彩系统

export const PALETTE = {
  // 夯土外墙 (Rammed Earth)
  EARTH_WARM: '#c79255',
  EARTH_OCHRE: '#d8a467',
  EARTH_DARK: '#a8743b',
  EARTH_GREY_BROWN: '#9b704c',
  EARTH_DEEP: '#865b32',
  EARTH_MOSSY: '#8a8352',

  // 木构与门窗 (Timber & Joinery)
  TIMBER_DARK: '#432a19',
  TIMBER_MID: '#5e3b22',
  TIMBER_OLD: '#382214',
  TIMBER_FLOOR: '#7b5634',
  TIMBER_LACQUER: '#6e281b',

  // 屋瓦与檐口 (Roof Tiles & Eaves)
  ROOF_CHARCOAL: '#2b2d31',
  ROOF_SLATE: '#393c42',
  ROOF_DARK_RIDGE: '#1f2124',
  ROOF_EAVES: '#4a4d53',
  ROOF_MOSS: '#4e6538',

  // 石材与台阶 (Stone & Granite)
  STONE_LIGHT: '#9fa4aa',
  STONE_MID: '#84898e',
  STONE_DARK: '#686c70',
  STONE_WELL: '#5a6066',
  STONE_PEBBLE: '#777d84',

  // 水体 (Water)
  WATER_STREAM: '#4682b4',
  WATER_WELL: '#264653',

  // 地形与梯田 (Terrain & Terraces)
  TERRAIN_DIRT: '#7a664d',
  TERRAIN_GRASS_MID: '#567d3d',
  TERRAIN_GRASS_DARK: '#456930',
  TERRAIN_CROP: '#699841',
  TERRAIN_TOPSOIL: '#5d4a36',

  // 植被 (Bamboo & Pine & Shrubs)
  BAMBOO_STALK: '#5e8f3c',
  BAMBOO_LEAF: '#74a849',
  BAMBOO_LEAF_LIGHT: '#8ec259',
  PINE_TRUNK: '#422e1e',
  PINE_NEEDLE_DARK: '#274728',
  PINE_NEEDLE_MID: '#335c34',
  SHRUB_FLOWER: '#c26161',

  // 农家道具与灯笼 (Props & Lanterns)
  LANTERN_RED: '#c02c25',
  LANTERN_GOLD: '#ffcc44',
  LANTERN_GLOW: '#ffaa44',
  PLAQUE_GOLD: '#d4af37',
  FIREWOOD_LOG: '#9e794b',
  FIREWOOD_BARK: '#694c2d',
  HAY_GOLD: '#cbb360',
  IRON_FITTING: '#33373b'
};

export const COLOR_VARS = {
  // 夯土外墙随机微变
  rammedEarthVariation: [
    PALETTE.EARTH_WARM,
    PALETTE.EARTH_OCHRE,
    PALETTE.EARTH_DARK,
    PALETTE.EARTH_GREY_BROWN,
    PALETTE.EARTH_DEEP
  ],
  // 屋面瓦片随机微变
  roofTileVariation: [
    PALETTE.ROOF_CHARCOAL,
    PALETTE.ROOF_SLATE,
    PALETTE.ROOF_DARK_RIDGE,
    PALETTE.ROOF_EAVES
  ],
  // 石材地面随机微变
  stonePavingVariation: [
    PALETTE.STONE_LIGHT,
    PALETTE.STONE_MID,
    PALETTE.STONE_DARK,
    PALETTE.STONE_PEBBLE
  ]
};
