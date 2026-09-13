const express = require('express');
const cors = require('cors');
require('dotenv').config();

const productsRoutes = require('./routes/products.routes');
const clientsRoutes = require('./routes/clients.routes');
const salesRoutes = require('./routes/sales.routes');
const paymentsRoutes = require('./routes/payments.routes');
const reportsRoutes = require('./routes/reports.routes');
const auditRoutes = require('./routes/audit.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('GerlyMaster API is running ✅'));

app.use('/api/products', productsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/audit', auditRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`GerlyMaster server running on port ${PORT}`));