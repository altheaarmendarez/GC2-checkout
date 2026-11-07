require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public')); 

const PORT = process.env.PORT || 3000;

// Mock Database (Products with names, prices, stock)
let products = [
  { id: 1, name: "UP Town Center", price_per_kwh: 26.00, stock: 4 },
  { id: 2, name: "SM North EDSA", price_per_kwh: 26.50, stock: 2 },
  { id: 3, name: "Ayala Malls Manila Bay", price_per_kwh: 27.00, stock: 0 }
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

// 3. POST /api/orders (Create Order with server validation & stock deduction)
app.post('/api/orders', (req, res) => {
  const { customer_name, customer_email, items } = req.body;

  // Validation 1: Required fields missing -> 400 Bad Request
  if (!customer_name || !customer_email || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Missing required fields or invalid items array" });
  }

  let serverTotal = 0;
  const orderItems = [];

  // Validation 2: Quantity check, Stock check, Recalculate total on server
  for (const item of items) {
    const product = products.find(p => p.id === parseInt(item.product_id));
    
    if (!product) {
      return res.status(404).json({ error: `Product ID ${item.product_id} not found` });
    }
    if (item.quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be greater than 0" });
    }
    if (item.quantity > product.stock) {
      return res.status(409).json({ error: `Not enough stock for ${product.name}. Available stock: ${product.stock}` });
    }

    serverTotal += product.price * item.quantity;
    orderItems.push({
      product_id: product.id,
      name: product.name,
      price: product.price,
      quantity: item.quantity
    });
  }

  // Deduct stock in database
  orderItems.forEach(item => {
    const product = products.find(p => p.id === item.product_id);
    product.stock -= item.quantity;
  });

  // Save order
  const newOrder = {
    id: orders.length + 1,
    customer_name,
    customer_email,
    items: orderItems,
    total: serverTotal,
    createdAt: new Date().toISOString()
  };

  orders.push(newOrder);
  res.status(201).json(newOrder);
});

// 4. GET /api/orders/:id (Read saved order by ID)
app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === parseInt(req.params.id));
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.status(200).json(order);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
