// Expo 모노레포 대응 (04 §4-5).
// 저장소 루트를 watch 하고 루트 node_modules 를 해석 경로에 넣어야
// apps/mobile 이 packages/shared 를 import 할 수 있다.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// 워크스페이스 패키지가 루트에 호이스트돼도 중복 해석되지 않게 한다.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
