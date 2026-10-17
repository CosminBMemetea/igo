const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

module.exports = config => withAndroidManifest(config, config => {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
  // Debug's separate manifest may allow Metro locally; Release only uses HTTPS.
  app.$["android:usesCleartextTraffic"] = "false";
  return config;
});
