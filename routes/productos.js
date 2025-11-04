import express from "express";
import Producto from "../models/producto.js";
import { AppError, NotFoundError, ValidationError, DatabaseError } from "../middleware/errorHandler.js";

const router = express.Router();
// GET todos los productos
router.get("/", async (req, res, next) => {
  try {
    const productos = await Producto.find();
    res.json({
      status: 'success',
      results: productos.length,
      data: { productos }
    });
  } catch (error) {
    next(new DatabaseError('Error al obtener los productos'));
  }
});

// GET producto por ID
router.get("/:id", async (req, res, next) => {
  try {
    const producto = await Producto.findById(req.params.id);
    
    if (!producto) {
      return next(new NotFoundError('Producto no encontrado'));
    }
    
    res.json({
      status: 'success',
      data: { producto }
    });
  } catch (error) {
    next(error);
  }
});

// POST crear nuevo producto
router.post("/", async (req, res, next) => {
  try {
    const { nombre, descripcion, precio, categoria, stock } = req.body;

    if (!nombre || !descripcion || !precio || !categoria || !stock) {
      return next(new ValidationError('Todos los campos son obligatorios'));
    }

    if (precio < 0) {
      return next(new ValidationError('El precio no puede ser negativo'));
    }

    if (stock < 0) {
      return next(new ValidationError('El stock no puede ser negativo'));
    }

    const nuevoProducto = new Producto(req.body);
    const productoGuardado = await nuevoProducto.save();
    
    res.status(201).json({
      status: 'success',
      data: { producto: productoGuardado }
    });
  } catch (error) {
    next(error);
  }
});

// PUT actualizar producto
router.put("/:id", async (req, res, next) => {
  try {
    const productoActualizado = await Producto.findByIdAndUpdate(
      req.params.id,
      req.body,
      { 
        new: true,
        runValidators: true
      }
    );
    
    if (!productoActualizado) {
      return next(new NotFoundError('Producto no encontrado'));
    }
    
    res.json({
      status: 'success',
      data: { producto: productoActualizado }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE eliminar producto
router.delete("/:id", async (req, res, next) => {
  try {
    const productoEliminado = await Producto.findByIdAndDelete(req.params.id);
    
    if (!productoEliminado) {
      return next(new NotFoundError('Producto no encontrado'));
    }
    
    res.json({
      status: 'success',
      message: 'Producto eliminado correctamente',
      data: null
    });
  } catch (error) {
    next(error);
  }
});

export default router;