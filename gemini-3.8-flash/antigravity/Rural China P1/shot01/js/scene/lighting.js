// js/scene/lighting.js
// 柔和自然日光与中式微缩景观氛围照明系统 (适配大体量宏伟土楼)

import * as THREE from 'three';

export function setupLighting(lightingGroup, scene) {
  // 1. 天空半球漫射光
  const hemiLight = new THREE.HemisphereLight(0xb4cbe0, 0x765e49, 1.0);
  hemiLight.name = "SkyHemisphereLight";
  hemiLight.position.set(0, 60, 0);
  lightingGroup.add(hemiLight);

  // 2. 主太阳斜射平行光 (午后温暖阳光，金黄倾泻)
  const sunLight = new THREE.DirectionalLight(0xfff5e1, 1.9);
  sunLight.name = "SunDirectionalLight";
  sunLight.position.set(48, 64, 36);
  sunLight.castShadow = true;

  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 160;

  const d = 52;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0004;

  lightingGroup.add(sunLight);

  // 3. 背光漫射补光
  const fillLight = new THREE.DirectionalLight(0xa5bed8, 0.6);
  fillLight.name = "ShadowFillLight";
  fillLight.position.set(-40, 30, -35);
  lightingGroup.add(fillLight);

  // 4. 天井中央柔和补光
  const courtLight = new THREE.PointLight(0xffeedd, 1.0, 38);
  courtLight.name = "CourtyardFillLight";
  courtLight.position.set(0, 10, 0);
  lightingGroup.add(courtLight);

  // 四方环廊木构微光
  const corridorLights = [
    [0, 8, 12],
    [0, 8, -12],
    [12, 8, 0],
    [-12, 8, 0]
  ];
  corridorLights.forEach(([lx, ly, lz], idx) => {
    const pl = new THREE.PointLight(0xffaa55, 1.3, 16, 1.8);
    pl.name = `CorridorGlow_${idx}`;
    pl.position.set(lx, ly, lz);
    lightingGroup.add(pl);
  });

  // 5. 南大门两侧红灯笼暖光 (Z=22.5)
  const lanternLightLeft = new THREE.PointLight(0xff8833, 2.5, 9, 1.5);
  lanternLightLeft.name = "EntranceLantern_Left";
  lanternLightLeft.position.set(-4, 3, 22.8);
  lightingGroup.add(lanternLightLeft);

  const lanternLightRight = new THREE.PointLight(0xff8833, 2.5, 9, 1.5);
  lanternLightRight.name = "EntranceLantern_Right";
  lanternLightRight.position.set(4, 3, 22.8);
  lightingGroup.add(lanternLightRight);

  // 烟岚薄雾
  scene.fog = new THREE.FogExp2(0xc8d7e6, 0.007);

  return {
    sunLight,
    hemiLight,
    fillLight,
    lanternLightLeft,
    lanternLightRight
  };
}
