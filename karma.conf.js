module.exports = (config) => {
  config.set({
    basePath: 'src',
    singleRun: true,
    providers: ['jasmine'],
    frameworks: ['jasmine'],
    browsers: ['Chrome'],
    files: [
      '../test/specs/*Spec.js',
      '../src/*.js',
    ],
    preprocessors: {
      '../test/specs/*Spec.js': ['commonjs'],
      '../src/*.js': ['commonjs']
    }
//    preprocessors: {
//      'test/**/*.spec.js': ['webpack'],
//    },
//    webpack: {
//      resolve: {
//        extensions: ['', '.js', '.ts'],
//        modulesDirectories: ['node_modules', 'src'],
//      },
//      module: {
//        loaders: [{
//          test: /\.js$/,
//          loader: 'babel-loader',
//        }],
//      },
//    },
//    webpackMiddleware: {
//      stats: {
//        color: true,
//        chunkModules: false,
//        modules: false,
//      },
//    },
  });
};
