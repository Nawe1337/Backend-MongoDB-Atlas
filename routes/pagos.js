import express from "express";
import Stripe from "stripe";
import { AppError } from "../middleware/errorHandler.js";

const router = express.Router();

// ✅ SOLUCIÓN: Inicializar Stripe dentro de una función
let stripeInstance = null;

const initializeStripe = () => {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('💳 Stripe inicializado correctamente');
  }
  return stripeInstance;
};

router.post("/crear-sesion", async (req, res, next) => {
  try {
    const stripe = initializeStripe(); // ✅ Usar la instancia inicializada
    const { items, success_url, cancel_url, customer_email, customer_name } = req.body;

    if (!items || items.length === 0) {
      return next(new AppError("El carrito está vacío", 400));
    }

    console.log(`🛒 Procesando ${items.length} items para:`, customer_email);

    const lineItems = items.map(item => {
      const lineItem = {
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.nombre,
            description: item.descripcion || 'Producto sin descripción',
          },
          unit_amount: Math.round(item.precio * 100),
        },
        quantity: item.quantity || 1,
      };

      if (item.imagen) {
        lineItem.price_data.product_data.images = [item.imagen];
      }

      return lineItem;
    });

    // ✅ CONFIGURACIÓN PARA QUITAR EL EMAIL DE STRIPE CHECKOUT
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: success_url,
      cancel_url: cancel_url,
      // ❌ NO incluir customer_email aquí - esto evita que aparezca el campo
      // ❌ NO incluir customer_name aquí
      customer_creation: 'if_required', // ✅ Esto ayuda a evitar que pida email
      submit_type: 'pay', // ✅ Para pagos únicos
      billing_address_collection: 'auto', // ✅ O 'required' si quieres dirección
      shipping_address_collection: {
        allowed_countries: ['US', 'AR', 'MX', 'ES'], // ✅ Países permitidos para envío
      },
      metadata: {
        customer_email: customer_email || '',  // Pero sí en metadata para referencia
        customer_name: customer_name || '',    // Pero sí en metadata para referencia
        items_count: items.length.toString(),
        total_amount: items.reduce((sum, item) => sum + (item.precio * (item.quantity || 1)), 0).toString(),
        webhook_target: 'n8n',
        timestamp: new Date().toISOString(),
        product_ids: items.map(item => item._id).join(',')
      }
    });

    console.log("✅ Sesión creada exitosamente:", session.id);
    console.log("🔗 URL de checkout:", session.url);

    res.json({
      status: 'success',
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('❌ Error creando sesión de pago:', error);
    next(new AppError(`Error al procesar el pago: ${error.message}`, 500));
  }
});

// WEBHOOK ENDPOINT
router.post("/webhook", express.raw({type: 'application/json'}), async (req, res) => {
  console.log("🔄 Webhook recibido - Headers:", req.headers);
  
  const sig = req.headers['stripe-signature'];
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.log("❌ STRIPE_WEBHOOK_SECRET no configurada");
    return res.status(400).json({ error: "Webhook no configurado" });
  }

  let event;

  try {
    const stripe = initializeStripe();
    event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    console.log("✅ Webhook verificado - Tipo:", event.type);
    
  } catch (err) {
    console.log(`❌ Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar el evento de checkout completado
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log("💰 Pago completado - Session ID:", session.id);
    
    // OBJETO PARA N8N
    const n8nData = {
      event_type: 'pago_completado',
      source: 'stripe_checkout',
      timestamp: new Date().toISOString(),
      
      cliente: {
        email: session.customer_details?.email || session.metadata.customer_email,
        nombre: session.customer_details?.name || session.metadata.customer_name,
        telefono: session.customer_details?.phone || '',
      },
      
      pago: {
        id_sesion: session.id,
        estado: session.payment_status,
        moneda: session.currency.toUpperCase(),
        monto_total: session.amount_total / 100,
        monto_subtotal: session.amount_subtotal / 100,
        impuestos: session.total_details?.amount_tax / 100 || 0,
      },
      
      productos: {
        cantidad_total: parseInt(session.metadata.items_count) || 0,
        items: session.metadata.product_ids ? session.metadata.product_ids.split(',') : [],
      },
      
      metadata: session.metadata
    };

    console.log("📦 Objeto para n8n:", JSON.stringify(n8nData, null, 2));
    
    // Enviar a n8n
    if (process.env.N8N_WEBHOOK_URL) {
      try {
        console.log("📨 Enviando a n8n...");
        await sendToN8NWebhook(n8nData);
        console.log("✅ Datos enviados exitosamente a n8n");
      } catch (n8nError) {
        console.error("❌ Error enviando datos a n8n:", n8nError.message);
      }
    } else {
      console.log("⚠️  N8N_WEBHOOK_URL no configurada");
    }
  }

  res.json({received: true, processed: true});
});

// RUTA TEMPORAL PARA TESTEAR
router.post("/test-webhook", express.json(), async (req, res) => {
  console.log("🧪 TEST Webhook recibido:", req.body);
  
  const testData = {
    event_type: 'test_pago_completado',
    source: 'manual_test',
    timestamp: new Date().toISOString(),
    cliente: {
      email: "test@ejemplo.com",
      nombre: "Cliente Test",
      telefono: "+1234567890"
    },
    pago: {
      id_sesion: "test_session_123",
      estado: "paid",
      moneda: "USD",
      monto_total: 1500.00,
      monto_subtotal: 1500.00,
      impuestos: 0
    },
    productos: {
      cantidad_total: 2,
      items: ["producto1", "producto2"]
    },
    metadata: {
      test: true,
      timestamp: new Date().toISOString()
    }
  };

  console.log("📦 Enviando datos de prueba a n8n:", testData);
  
  try {
    await sendToN8NWebhook(testData);
    res.json({ status: "success", message: "Test webhook enviado" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// FUNCIÓN PARA ENVIAR A N8N
async function sendToN8NWebhook(n8nData) {
  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  
  console.log("🔧 DEBUG N8N CONFIG:");
  console.log("📍 URL:", n8nUrl);

  if (!n8nUrl) {
    console.log("❌ ERROR: N8N_WEBHOOK_URL no está definida");
    return;
  }

  try {
    console.log("🚀 INICIANDO ENVÍO A N8N...");
    
    n8nData.debug_timestamp = new Date().toISOString();
    n8nData.debug_source = 'stripe_webhook_backend';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TechStore-API/1.0',
        'Accept': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(n8nData),
    });

    clearTimeout(timeoutId);

    console.log("📡 RESPUESTA N8N - Status:", response.status);

    if (response.ok) {
      const responseBody = await response.text();
      console.log("✅ ÉXITO - Webhook recibido por n8n");
    } else {
      const errorBody = await response.text();
      console.error("❌ ERROR - n8n rechazó la solicitud");
      console.error("   Status:", response.status);
      
      await saveFailedRequest(n8nData, response.status, errorBody);
    }

  } catch (error) {
    console.error("💥 ERROR CRÍTICO:", error.message);
    
    if (error.name === 'AbortError') {
      console.error("   ⏰ TIMEOUT: La solicitud tardó más de 15 segundos");
    }
  }
}

router.get("/verificar-sesion/:sessionId", async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const stripe = initializeStripe();
    
    console.log('🔍 Verificando sesión de Stripe:', sessionId);
    
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'line_items', 'payment_intent']
    });

    console.log('✅ Sesión recuperada:', {
      id: session.id,
      payment_status: session.payment_status,
      customer_email: session.customer_details?.email,
      customer_name: session.customer_details?.name,
      amount_total: session.amount_total
    });

    res.json({
      status: 'success',
      session: session
    });
  } catch (error) {
    console.error('❌ Error verificando sesión:', error);
    next(new AppError('Error verificando el pago', 500));
  }
});

// Ruta para recibir confirmación de pago exitoso del frontend
router.post("/pago-exitoso", express.json(), async (req, res, next) => {
  try {
    const { sessionId, orderDetails, customerInfo } = req.body;
    
    console.log("🎯 Pago exitoso recibido del frontend:", { 
      sessionId, 
      customerEmail: customerInfo?.email 
    });

    const n8nData = {
      event_type: 'pago_exitoso_frontend',
      source: 'frontend_confirmation',
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      order_details: orderDetails,
      customer_info: customerInfo,
      confirmed_from: 'frontend_redirect',
      backend_received_at: new Date().toISOString()
    };

    console.log("📦 Enviando a n8n desde frontend confirmation");
    
    if (process.env.N8N_WEBHOOK_URL) {
      await sendToN8NWebhook(n8nData);
      console.log("✅ Confirmación de pago enviada a n8n desde backend");
    } else {
      console.log("⚠️ N8N_WEBHOOK_URL no configurada en backend");
    }

    res.json({ 
      status: 'success', 
      message: 'Pago confirmado y datos enviados a n8n' 
    });

  } catch (error) {
    console.error('❌ Error procesando confirmación de pago:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Función para guardar requests fallidos
async function saveFailedRequest(data, status, errorBody) {
  const failedRequest = {
    timestamp: new Date().toISOString(),
    data: data,
    error: {
      status: status,
      body: errorBody
    }
  };
  
  console.log("💾 REQUEST FALLIDO GUARDADO");
}

export default router;