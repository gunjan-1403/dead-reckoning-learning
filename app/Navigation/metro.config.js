// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle the ONNX model binary as an asset.
config.resolver.assetExts.push('onnx');

module.exports = config;
