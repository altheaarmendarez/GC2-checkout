require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public'));
app.get('/', (req, res) => res.redirect('/checkout.html'));

const PORT = process.env.PORT || 3000;

const RESERVATION_FEE = 50;
const DEPOSIT = 100;
const PAYMENT_METHODS = ['GCash', 'Maya Wallet', 'Card', 'Watt Credits'];

// Mock database: each "product" is a charging socket. stock = free sockets.
let products = [
  { id: 1, name: "UP Town Center · Socket #1", price_per_kwh: 26, stock: 4 },
  { id: 2, name: "Eastwood Mall · Socket #1", price_per_kwh: 0, stock: 2 },
  { id: 3, name: "SM North EDSA · Socket #1", price_per_kwh: 24, stock: 0 }
];

let orders = [];

// 1. GET /api/products (List & search)
app.get('/api/products', (req, res) => {
  const q = req.query.q ? req.query.q.toLowerCase() : '';
  const filtered = products.filter(p => p.name.toLowerCase().includes(q));
  res.status(200).json(filtered);
});

// 2. GET /api/products/:id (Detail)
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.status(200).json(product);
});

// 3. POST /api/orders (reservation checkout with server-side billing)
app.post('/api/orders', (req, res) => {
  const { customer_name, customer_email, payment_method, product_id, kwh } = req.body;

  if (!customer_name || !customer_email || !product_id || !kwh)
    return res.status(400).json({ error: "Missing required fields" });
  if (!PAYMENT_METHODS.includes(payment_method))
    return res.status(400).json({ error: "Invalid payment method" });
  if (!(Number(kwh) > 0))
    return res.status(400).json({ error: "kWh must be greater than 0" });

  const socket = products.find(p => p.id === parseInt(product_id));
  if (!socket) return res.status(404).json({ error: "Socket not found" });
  if (socket.stock < 1)
    return res.status(409).json({ error: "No free sockets at this station" });

  const charging = Math.round(socket.price_per_kwh * Number(kwh) * 100) / 100;
  const total = Math.round((charging + RESERVATION_FEE + DEPOSIT) * 100) / 100;
  socket.stock -= 1;

  const order = {
    id: orders.length + 1,
    customer_name,
    customer_email,
    payment_method,
    socket: socket.name,
    kwh: Number(kwh),
    breakdown: { charging, reservation_fee: RESERVATION_FEE, deposit: DEPOSIT },
    total,
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  res.status(201).json(order);
});

// 4. GET /api/orders (all placed bookings, newest first)
app.get('/api/orders', (req, res) => {
  res.status(200).json([...orders].reverse());
});

// 5. GET /api/metrics (owner dashboard)
app.get('/api/metrics', (req, res) => {
  const round = n => Math.round(n * 100) / 100;
  const totalOrders = orders.length;
  const totalRevenue = round(orders.reduce((sum, o) => sum + o.total, 0));
  const averageOrderValue = totalOrders ? round(totalRevenue / totalOrders) : 0;

  // Top-selling station: most bookings, ties broken by total kWh
  const byStation = {};
  for (const o of orders) {
    const s = byStation[o.socket] || (byStation[o.socket] = { name: o.socket, orders: 0, kwh: 0 });
    s.orders += 1;
    s.kwh = round(s.kwh + o.kwh);
  }
  const ranked = Object.values(byStation).sort((a, b) => b.orders - a.orders || b.kwh - a.kwh);

  // Low stock: stations with fewer than 5 open slots
  const lowStock = products
    .filter(p => p.stock < 5)
    .map(p => ({ id: p.id, name: p.name, available_slots: p.stock }));

  res.status(200).json({
    total_orders: totalOrders,
    total_revenue: totalRevenue,
    average_order_value: averageOrderValue,
    top_selling_station: ranked[0] || null,
    low_stock: lowStock
  });
});

// 6. GET /api/orders/:id (Read saved order by ID)
app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === parseInt(req.params.id));
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.status(200).json(order);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});