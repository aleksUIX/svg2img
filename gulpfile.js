var gulp = require('gulp');
var concat = require('gulp-concat');
var browserify = require('gulp-browserify');
var Server = require('karma').Server;


gulp.task('bundle-js', function() {
  gulp.src('src/App.js')
    .pipe(browserify())
    .pipe(concat('bundle.js'))
    .pipe(gulp.dest('dist'));
});


gulp.task('test', function (done) {
  new Server({
    configFile: __dirname + '/karma.conf.js',
    singleRun: true
  }, done).start();
});

gulp.task('default', ['bundle-js']);
