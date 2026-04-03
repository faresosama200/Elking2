function validate(schema, pick = "body") {
  return (req, res, next) => {
    const parsed = schema.safeParse(req[pick]);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
    }
    req[pick] = parsed.data;
    return next();
  };
}

module.exports = validate;
