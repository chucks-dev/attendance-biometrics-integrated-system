/**
 * Wraps an async Express route handler so rejected promises are
 * forwarded to next() instead of crashing the process / hanging
 * the request.
 */
function catchAsync(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = catchAsync;
