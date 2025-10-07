// netlify/functions/stripe-webhook.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // sua chave secreta da API (sk_test_...)
exports.handler = async (event) => {
  // Stripe envia a assinatura neste header
  const sig = event.headers['stripe-signature'];

  try {
    // MUITO IMPORTANTE: usar o body bruto (string), sem JSON.parse
    const evt = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Trate os eventos que você precisa
    if (evt.type === 'checkout.session.completed') {
      const session = evt.data.object;
      // ... sua lógica
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }
};
