// A custom error that carries an HTTP status code.
// Throw it anywhere in a route/controller: `throw new AppError('Not found', 404)`
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export default AppError;
