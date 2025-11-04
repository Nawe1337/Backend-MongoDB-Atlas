import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import productosRouter from "./routes/productos.js";
import pagosRouter from "./routes/pagos.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

// ✅ CARGAR VARIABLES DE ENTORNO PRIMERO
dotenv.config();

// ✅ VALIDAR VARIABLES CRÍTICAS
console.log('🔍 Verificando variables de entorno...');
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '✅ CONFIGURADA' : '❌ FALTANTE');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ CONFIGURADA' : '❌ FALTANTE');

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ ERROR: STRIPE_SECRET_KEY no está definida');
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI no está definida');
  process.exit(1);
}

const app = express();

// Configuración de CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || "http://localhost:5173");
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type', 'Authorization');
  next();
});

// Middleware para JSON (excepto webhooks)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/pagos/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => console.error("❌ Error al conectar con MongoDB:", err));

// Rutas
app.use("/api/productos", productosRouter);
app.use("/api/pagos", pagosRouter);

// Ruta base
app.get("/", (req, res) => {
  res.json({
    status: 'success',
    message: 'API de productos funcionando 🚀',
    version: '1.0.0',
    stripe_configured: !!process.env.STRIPE_SECRET_KEY
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured',
    database: 'connected'
  });
});

// Manejo de rutas no encontradas
app.use(notFoundHandler);

// Manejo global de errores
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
  console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO'}`);
  console.log(`📧 N8N Webhook: ${process.env.N8N_WEBHOOK_URL || 'No configurado'}`);
});