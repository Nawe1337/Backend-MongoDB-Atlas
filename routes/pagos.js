import express from "express";
import Stripe from "stripe";
import { AppError } from "../middleware/errorHandler.js";

const router = express.Router();

// Configurar Stripe - usa tu clave real aquí
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '.');
router.post("/crear-sesion", async (req, res, next) => {
  try {
    console.log("🔔 Recibiendo solicitud de pago...");
    console.log("Body recibido:", JSON.stringify(req.body, null, 2));

    const { items, success_url, cancel_url } = req.body;

    // Validar que hay items
    if (!items || items.length === 0) {
      console.log("❌ Carrito vacío");
      return next(new AppError("El carrito está vacío", 400));
    }

    // Validar estructura de items
    items.forEach((item, index) => {
      if (!item.nombre || !item.precio) {
        console.log(`❌ Item ${index} inválido:`, item);
        throw new Error(`Item ${index} no tiene nombre o precio`);
      }
    });

    // Crear line items para Stripe
    const lineItems = items.map(item => {
      const lineItem = {
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.nombre,
            description: item.descripcion || 'Producto sin descripción',
          },
          unit_amount: Math.round(item.precio * 100), // Stripe espera centavos
        },
        quantity: item.quantity || 1,
      };

      // Agregar imagen solo si existe
      if (item.imagen) {
        lineItem.price_data.product_data.images = [item.imagen];
      }

      console.log(`📦 Line item creado:`, lineItem);
      return lineItem;
    });

    console.log("🛒 Creando sesión de Stripe...");

    // Crear sesión de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: success_url || `http://localhost:5173/pago-exitoso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `http://localhost:5173/carrito`,
      metadata: {
        items_count: items.length.toString()
      }
    });

    console.log("✅ Sesión creada exitosamente:", session.id);

    res.json({
      status: 'success',
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('❌ Error completo creando sesión de pago:', error);
    console.error('❌ Stack trace:', error.stack);
    next(new AppError(`Error al procesar el pago: ${error.message}`, 500));
  }
});

export default router;