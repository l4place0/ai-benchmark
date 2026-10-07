// 全局布局常量与工具
export const TRACK_NEAR_Z = -21.7;   // 站台侧轨道中心线
export const TRACK_FAR_Z  = -24.9;   // 第二条轨道中心线
export const PLATFORM = { x0: -8, x1: 24, z0: -19.6, z1: -16.0, h: 0.55 };
export const PLAZA    = { x0: -14, x1: 14.5, z0: -12.2, z1: -2.0 };
export const CROSS_X  = 26;          // 铁路道口所在的东西向道路 x

export function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
