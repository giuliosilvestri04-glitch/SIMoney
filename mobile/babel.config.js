/**
 * Configurazione Babel.
 * `babel-preset-expo` include già il supporto a expo-router.
 * Il plugin dei worklets è richiesto da react-native-reanimated 4 e deve
 * restare l'ultimo della lista.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
