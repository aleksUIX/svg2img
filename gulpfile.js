const gulp = require('gulp');
const concat = require('gulp-concat');
const browserify = require('browserify');
const babel = require('babelify');
const source = require('vinyl-source-stream');
const Server = require('karma').Server;


gulp.task('bundle-js', function() {
  return browserify({ entries: './src/App.js', extensions: ['.js'], debug: true })
    .transform(babel)
    .bundle()
    .pipe(source('bundle.js'))
    .pipe(gulp.dest('dist'));
});

// gulp.task('test', function (done) {
//   new Server({
//     configFile: __dirname + '/karma.conf.js',
//     singleRun: true
//   }, function() {
//     done();
//   }).start();
// });
//
// gulp.task('tdd', function (done) {
//   new Server({
//     configFile: __dirname + '/karma.conf.js'
//   }, done).start();
// });


gulp.task('default', ['bundle-js']);
