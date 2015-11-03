var gulp = require('gulp');
var istanbul = require('gulp-istanbul');
var jasmine = require('gulp-jasmine');

var isWatching = false;

gulp.task('instrument', function () {
  return gulp.src(['lib/**/*.js'])
    .pipe(istanbul())
    .pipe(istanbul.hookRequire());
});

gulp.task('coverage', ['instrument'], function () {
  var hasErrors = 0;
  return gulp.src(['test/**/*.js'])
    .pipe(jasmine({
      verbose: false,
      includeStackTrace: true
    }))
    .on('error', function (err) {
      hasErrors++;
      console.log(err);
      this.emit('end');
    })
    .pipe(istanbul.writeReports())
    .pipe(istanbul.enforceThresholds({thresholds: {global: 10}}))
    .on('end', function () {
      process.exit(hasErrors);
    });
});

gulp.task('test', function () {
  var hasErrors = 0;
  return gulp.src(['test/**/*.js'])
    .pipe(jasmine({
      verbose: false,
      includeStackTrace: true
    }))
    .on('error', function () {
      hasErrors++;
      this.emit('end');
    }).
    on('end', function () {
      process.exit(hasErrors);
    })
});
