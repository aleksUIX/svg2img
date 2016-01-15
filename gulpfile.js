var gulp = require('gulp');
var concat = require('gulp-concat');
var browserify = require('gulp-browserify');


gulp.task('bundle-js', function() {
  gulp.src('src/index.js')
    .pipe(browserify())
    .pipe(concat('bundle.js'))
    .pipe(gulp.dest('dist'));
});


gulp.task('default', ['bundle-js']);
