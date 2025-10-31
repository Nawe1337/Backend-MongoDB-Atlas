// seeders/productosSeeder.js
import mongoose from "mongoose";
import Producto from "../models/producto.js";
import dotenv from "dotenv";

dotenv.config();

const productosEjemplo = [
  {
    nombre: "Laptop Gaming ASUS ROG",
    descripcion: "Laptop para gaming de alto rendimiento con RTX 4060",
    precio: 1500,
    categoria: "Tecnología",
    stock: 10,
    imagen: "https://ejemplo.com/laptop1.jpg"
  },
  {
    nombre: "iPhone 15 Pro Max",
    descripcion: "Smartphone flagship de Apple con cámara 48MP",
    precio: 1200,
    categoria: "Tecnología",
    stock: 15,
    imagen: "https://ejemplo.com/iphone15.jpg"
  },
  {
    nombre: "Samsung Galaxy S24 Ultra",
    descripcion: "Teléfono Android con S-Pen integrado y AI",
    precio: 1100,
    categoria: "Tecnología",
    stock: 8,
    imagen: "https://ejemplo.com/samsung-s24.jpg"
  }
];

const seedProductos = async () => {
  try {
    console.log("🌱 Iniciando seeder...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    // Limpiar la colección
    await Producto.deleteMany({});
    console.log("🗑️ Colección limpiada");

    // Insertar productos
    const productosCreados = await Producto.insertMany(productosEjemplo);
    console.log(`✅ ${productosCreados.length} productos insertados`);

    await mongoose.connection.close();
    console.log("🔌 Conexión cerrada");
    
    return productosCreados;
  } catch (error) {
    console.error("❌ Error en el seeder:", error);
    process.exit(1);
  }
};

// Ejecutar siempre que se llame el script
seedProductos();