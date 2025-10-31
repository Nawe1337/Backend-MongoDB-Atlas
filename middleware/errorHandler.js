// middleware/errorHandler.js
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Datos de entrada inválidos') {
    super(message, 400);
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Error en la base de datos') {
    super(message, 500);
  }
}

// Middleware principal de errores
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log del error en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.error('🔥 ERROR:', {
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      body: req.body
    });
  }

  // Error de Mongoose - Duplicado
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    err = new AppError(`El ${field} '${value}' ya existe`, 400);
  }

  // Error de validación de Mongoose
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(el => el.message);
    err = new ValidationError(`Datos inválidos: ${errors.join(', ')}`);
  }

  // Error de CastError (ID inválido)
  if (err.name === 'CastError') {
    err = new ValidationError(`ID inválido: ${err.value}`);
  }

  // Respuesta al cliente
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err
    })
  });
};

// Middleware para rutas no encontradas
const notFoundHandler = (req, res, next) => {
  next(new NotFoundError(`Ruta no encontrada: ${req.originalUrl}`));
};

export {
  AppError,
  NotFoundError,
  ValidationError,
  DatabaseError,
  errorHandler,
  notFoundHandler
};