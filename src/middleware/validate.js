/**
 * Validates req.body / req.query / req.params against a Zod schema
 * and replaces them with the parsed (typed, coerced) result.
 *
 * Usage: router.post('/x', validate({ body: createXSchema }), handler)
 */
function validate(schemas) {
  return function (req, res, next) {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      next(err); // ZodError handled centrally in errorHandler
    }
  };
}

module.exports = validate;
