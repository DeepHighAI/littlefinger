const path = require('node:path');

function createSafeQueryStringResolver(projectRoot) {
  const safeQueryStringPath = path.resolve(projectRoot, 'src/lib/query-string-safe.js');

  return (context, moduleName, platform) => {
    // Expo Router의 구형 파서가 조작된 딥링크에서 무한 연산하지 않도록 번들 경로를 고정한다.
    if (moduleName === 'query-string') {
      return { filePath: safeQueryStringPath, type: 'sourceFile' };
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = { createSafeQueryStringResolver };
