// js/scene/sceneManager.js
// 场景总控调度器 - 构建大尺度层级树、体素网格生成、镜头预设管理

import * as THREE from 'three';
import { VoxelScene } from '../voxel/voxelBuilder.js';
import { buildTerrain } from './terrain.js';
import { buildTulou } from './tulou.js';
import { buildVegetation } from './vegetation.js';
import { buildVillageProps } from './villageProps.js';
import { setupLighting } from './lighting.js';

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.voxelScene = new VoxelScene(1.0);
    this.hierarchyNodes = new Map();

    this.initThree();
    this.buildWorld();
    this.setupCameras();
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.name = "Scene";
    this.scene.background = new THREE.Color(0xd2e0ed);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 400);
    this.camera.position.set(45, 42, 52);
    this.camera.lookAt(0, 8, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  buildWorld() {
    console.log("Generating grand voxel world...");
    buildTerrain(this.voxelScene);
    buildTulou(this.voxelScene);
    buildVegetation(this.voxelScene);
    buildVillageProps(this.voxelScene);

    this.hierarchyNodes = this.voxelScene.buildHierarchy(this.scene);

    const lightingGroup = new THREE.Group();
    lightingGroup.name = "Lighting";
    this.scene.add(lightingGroup);
    this.hierarchyNodes.set('Lighting', lightingGroup);

    this.lights = setupLighting(lightingGroup, this.scene);
  }

  setupCameras() {
    this.cameraPresets = {
      // 1. 等距 3/4 俯视全景 (土楼占据画面 65%~75%，宏伟震撼)
      isometric_overview: {
        pos: new THREE.Vector3(45, 42, 52),
        target: new THREE.Vector3(0, 8, 0),
        fov: 38,
        desc: "3/4 等距微缩全景 - 宏大展现四层环形客家土楼、开敞大天井、中央祖堂与山地乡村"
      },
      // 2. 建筑入口与夯土细节
      architecture_detail: {
        pos: new THREE.Vector3(8, 7, 34),
        target: new THREE.Vector3(0, 4.5, 21.5),
        fov: 38,
        desc: "主入口与夯土细节 - 花岗岩石质台门、铜钉大门、金字木匾、红灯笼与生土厚墙"
      },
      // 3. 中央天井内部环廊
      courtyard_interior: {
        pos: new THREE.Vector3(0, 16, 9.5),
        target: new THREE.Vector3(0, 2.5, 0),
        fov: 54,
        desc: "中央大天井与木构环廊 - 中心祖堂、阴阳双古井、石桌石凳、晒秋竹匾与四层木廊"
      },
      // 4. 正俯视同心圆结构
      topdown: {
        pos: new THREE.Vector3(0.01, 75, 0.01),
        target: new THREE.Vector3(0, 0, 0),
        fov: 40,
        desc: "垂直俯视图 - 展现外墙、四层环廊、大天井与中心祖堂的宏伟向心同心圆格局"
      },
      // 5. 乡村田园远景
      village_landscape: {
        pos: new THREE.Vector3(58, 34, 58),
        target: new THREE.Vector3(0, 4, 0),
        fov: 42,
        desc: "乡村山地远景 - 竹林掩映、梯田茶园、溪流木桥与宏伟土楼自然共生"
      }
    };
  }

  setCameraView(viewKey) {
    const preset = this.cameraPresets[viewKey];
    if (!preset) return;

    this.camera.position.copy(preset.pos);
    this.camera.fov = preset.fov;
    this.camera.updateProjectionMatrix();

    if (this.controls) {
      this.controls.target.copy(preset.target);
      this.controls.update();
    } else {
      this.camera.lookAt(preset.target);
    }

    return preset;
  }

  onWindowResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
