var gulp = require('gulp');
var concat = require('gulp-concat');
var browserify = require('browserify');
var babel = require('babelify');
var source = require('vinyl-source-stream');
var Server = require('karma').Server;


gulp.task('build', function() {
  return browserify({ entries: './src/App.js', extensions: ['.js'], debug: true })
    //.transform(babel)
    .bundle()
    .pipe(source('bundle.js'))
    .pipe(gulp.dest('dist'));
});

gulp.task('watch', ['build'], function () {
  gulp.watch('src/*.js', ['build']);
  gulp.watch('src/**/*.js', ['build']);
});

gulp.task('default', ['watch']);

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


//gulp.task('default', ['bundle-js']);
