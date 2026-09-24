// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];

// Packages that must resolve to a single copy (the app's), even when imported
// from workspace packages such as @todo/shared that carry their own version.
const singletons = ["react", "react-native"];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isSingleton = singletons.some((name) => moduleName === name || moduleName.startsWith(`${name}/`));
  if (isSingleton) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, "index.ts") },
      moduleName,
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
