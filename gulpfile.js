const gulp = require('gulp');
const istanbul = require('gulp-istanbul');
const jasmine = require('gulp-jasmine');

gulp.task('instrument', function () {
  return gulp.src(['lib/**/*.js'])
    .pipe(istanbul())
    .pipe(istanbul.hookRequire());
});

gulp.task('coverage', gulp.series('instrument', function () {
  return gulp.src(['test/**/*.js'])
    .pipe(jasmine({
      verbose: false,
      includeStackTrace: true
    }))
    .on('error', function (err) {
      console.log(err);
      this.emit('end');
    })
    .pipe(istanbul.writeReports())
    .pipe(istanbul.enforceThresholds({thresholds: {global: 10}}))
}));

gulp.task('test', function () {
  return gulp.src(['test/**/*.js'])
    .pipe(jasmine({
      verbose: false,
      includeStackTrace: true
    }))
    .on('error', function (err) {
      console.log(err);
      this.emit('end');
    });
});
