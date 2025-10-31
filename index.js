import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import productosRouter from "./routes/productos.js";
import pagosRouter from "./routes/pagos.js"; // ← Nueva línea
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3001'],
  credentials: true
}));

app.use(express.json());

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => console.error("❌ Error al conectar con MongoDB:", err));

// Rutas
app.use("/api/productos", productosRouter);
app.use("/api/pagos", pagosRouter); // ← Nueva línea

// Ruta base
app.get("/", (req, res) => {
  res.json({
    status: 'success',
    message: 'API de productos funcionando 🚀',
    version: '1.0.0'
  });
});

// Manejo de rutas no encontradas
app.use(notFoundHandler);

// Manejo global de errores
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));