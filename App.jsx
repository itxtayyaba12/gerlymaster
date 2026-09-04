const { useState, useEffect, useRef } = React;

const API_BASE = 'http://localhost:5000/api';
const fmt = n => 'Rs ' + Number(n || 0).toLocaleString('en-PK');

async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

/* ---------- Reusable Chart component ---------- */
function ChartCanvas({type, data, options, height=230}){
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  useEffect(()=>{
    if(chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, {type, data, options});
    return ()=>{ if(chartRef.current) chartRef.current.destroy(); };
  }, [JSON.stringify(data), type]);
  return <canvas ref={canvasRef} height={height}></canvas>;
}

/* ---------- Main App ---------- */
function App(){
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [timeframeProfit, setTimeframeProfit] = useState(null);
  const [profitByProduct, setProfitByProduct] = useState([]);
  const [profitByCustomer, setProfitByCustomer] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [connError, setConnError] = useState('');

  const [activeSection, setActiveSection] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');

  const [productModal, setProductModal] = useState(null);
  const [clientModal, setClientModal] = useState(null);
  const [saleModal, setSaleModal] = useState(false);
  const [invoiceView, setInvoiceView] = useState(null);
  const [payModal, setPayModal] = useState(null);

  const [prodCategoryFilter, setProdCategoryFilter] = useState('');
  const [saleStatusFilter, setSaleStatusFilter] = useState('');
  const [payStatusFilter, setPayStatusFilter] = useState('');
  const [trendRange, setTrendRange] = useState(7);

  const fetchAll = async () => {
    try {
      setConnError('');
      const [p, c, s, sum, tf, pbp, pbc, paySum] = await Promise.all([
        apiFetch('/products'),
        apiFetch('/clients'),
        apiFetch('/sales'),
        apiFetch('/reports/dashboard-summary'),
        apiFetch('/reports/profit-by-timeframe'),
        apiFetch('/reports/profit-by-product'),
        apiFetch('/reports/profit-by-customer'),
        apiFetch('/payments/summary'),
      ]);
      setProducts(p); setClients(c); setSales(s);
      setSummary(sum); setTimeframeProfit(tf);
      setProfitByProduct(pbp); setProfitByCustomer(pbc);
      setPaymentSummary(paySum);
    } catch (err) {
      setConnError('Unable to connect to the backend. Please check that the Express server (localhost:5000) is running. Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const titles = {
    dashboard:['Dashboard',"Welcome back, here's your business overview"],
    products:['Product & Inventory','Manage your catalog and stock levels'],
    clients:['Clients','Manage client relationships and history'],
    sales:['Sales & Invoices','Create sales and track invoice history'],
    payments:['Payments','Track paid, pending and partial payments'],
    reports:['Reports & Analytics','Profit and margin insights across your business'],
  };

  const lowStockProducts = products.filter(p => p.stock <= p.threshold);

  const clientStats = clientId => {
    const clientSales = sales.filter(s => s.client_id === clientId);
    return {
      orders: clientSales.length,
      totalSpent: clientSales.reduce((a,s)=>a+Number(s.total),0),
      balanceDue: clientSales.reduce((a,s)=>a+Number(s.remaining),0),
    };
  };

  /* ---------- API-backed CRUD ---------- */
  const saveProduct = async (data, id) => {
    if (id) await apiFetch(`/products/${id}`, { method:'PUT', body: JSON.stringify(data) });
    else await apiFetch('/products', { method:'POST', body: JSON.stringify(data) });
    await fetchAll();
    setProductModal(null);
  };
  const deleteProduct = async id => {
    if (!window.confirm('Delete this product?')) return;
    try { await apiFetch(`/products/${id}`, { method:'DELETE' }); await fetchAll(); }
    catch(err){ alert(err.message); }
  };

  const saveClient = async (data, id) => {
    if (id) await apiFetch(`/clients/${id}`, { method:'PUT', body: JSON.stringify(data) });
    else await apiFetch('/clients', { method:'POST', body: JSON.stringify(data) });
    await fetchAll();
    setClientModal(null);
  };
  const deleteClient = async id => {
    if (!window.confirm('Delete this client? Their sales history will remain but unlinked.')) return;
    try { await apiFetch(`/clients/${id}`, { method:'DELETE' }); await fetchAll(); }
    catch(err){ alert(err.message); }
  };

  const saveSale = async (payload) => {
    const newSale = await apiFetch('/sales', { method:'POST', body: JSON.stringify(payload) });
    await fetchAll();
    setSaleModal(false);
    setInvoiceView(newSale);
  };

  const confirmPayment = async (saleId, amt) => {
    try {
      await apiFetch(`/payments/${saleId}/pay`, { method:'POST', body: JSON.stringify({ amount: amt }) });
      await fetchAll();
      setPayModal(null);
    } catch(err){ alert(err.message); }
  };

  if (loading) {
    return <div style={{padding:40, fontSize:15, color:'var(--text-muted)'}}>Loading GerlyMaster...</div>;
  }

  if (connError) {
    return (
      <div style={{padding:40, maxWidth:520}}>
        <h2 style={{marginBottom:10}}>⚠️ Connection Issue</h2>
        <p style={{color:'var(--text-muted)', marginBottom:16}}>{connError}</p>
        <button className="btn btn-primary" onClick={fetchAll}>Retry Connection</button>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar active={activeSection} setActive={s=>{setActiveSection(s); setSidebarOpen(false);}} open={sidebarOpen} />
      <div className="main">
        <Topbar
          title={titles[activeSection][0]} sub={titles[activeSection][1]}
          search={search} setSearch={setSearch}
          lowStockCount={lowStockProducts.length}
          onToggleSidebar={()=>setSidebarOpen(!sidebarOpen)}
        />
        <div className="content">
          {activeSection==='dashboard' &&
            <Dashboard summary={summary} sales={sales} lowStockProducts={lowStockProducts} timeframeProfit={timeframeProfit}
              clients={clients} trendRange={trendRange} setTrendRange={setTrendRange} />}
          {activeSection==='products' &&
            <ProductsSection products={products} filter={prodCategoryFilter} setFilter={setProdCategoryFilter}
              search={search} onAdd={()=>setProductModal('new')} onEdit={p=>setProductModal(p)} onDelete={deleteProduct} />}
          {activeSection==='clients' &&
            <ClientsSection clients={clients} search={search} clientStats={clientStats}
              onAdd={()=>setClientModal('new')} onEdit={c=>setClientModal(c)} onDelete={deleteClient} />}
          {activeSection==='sales' &&
            <SalesSection sales={sales} clients={clients} search={search} statusFilter={saleStatusFilter} setStatusFilter={setSaleStatusFilter}
              onNew={()=>setSaleModal(true)} onView={s=>setInvoiceView(s)} onPay={s=>setPayModal(s)} />}
          {activeSection==='payments' &&
            <PaymentsSection sales={sales} clients={clients} paymentSummary={paymentSummary}
              statusFilter={payStatusFilter} setStatusFilter={setPayStatusFilter} onPay={s=>setPayModal(s)} />}
          {activeSection==='reports' &&
            <ReportsSection profitByProduct={profitByProduct} profitByCustomer={profitByCustomer}
              summary={summary} timeframeProfit={timeframeProfit} />}
        </div>
      </div>

      {productModal && <ProductModal product={productModal==='new'?null:productModal}
        categories={[...new Set(products.map(p=>p.category))]}
        onSave={saveProduct} onClose={()=>setProductModal(null)} />}

      {clientModal && <ClientModal client={clientModal==='new'?null:clientModal}
        onSave={saveClient} onClose={()=>setClientModal(null)} />}

      {saleModal && <SaleModal products={products} clients={clients} onSave={saveSale} onClose={()=>setSaleModal(false)} />}

      {invoiceView && <InvoiceModal sale={invoiceView} client={clients.find(c=>c.id===invoiceView.client_id)} onClose={()=>setInvoiceView(null)} />}

      {payModal && <PayModal sale={payModal} onConfirm={confirmPayment} onClose={()=>setPayModal(null)} />}
    </div>
  );
}

/* ---------- Sidebar ---------- */
function Sidebar({active, setActive, open}){
  const items = [
    {group:'Overview', list:[['dashboard','📊 Dashboard']]},
    {group:'Management', list:[['products','📦 Products & Inventory'],['clients','👥 Clients'],['sales','🧾 Sales & Invoices'],['payments','💳 Payments']]},
    {group:'Insights', list:[['reports','📈 Reports & Analytics']]},
  ];
  return (
    <aside className={"sidebar" + (open?" open":"")}>
      <div className="logo"><div className="icon">G</div><div><h1>GerlyMaster</h1><span>Business Manager</span></div></div>
      <div className="nav-group">
        {items.map(g=>(
          <React.Fragment key={g.group}>
            <div className="nav-label">{g.group}</div>
            {g.list.map(([key,label])=>(
              <div key={key} className={"nav-item"+(active===key?" active":"")} onClick={()=>setActive(key)}>{label}</div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="sidebar-footer">
        <div className="avatar">AD</div>
        <div className="info"><b>Admin User</b><span>Owner / Admin</span></div>
      </div>
    </aside>
  );
}

/* ---------- Topbar ---------- */
function Topbar({title, sub, search, setSearch, lowStockCount, onToggleSidebar}){
  return (
    <div className="topbar">
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <button className="icon-btn mobile-toggle" onClick={onToggleSidebar}>☰</button>
        <div><h2>{title}</h2><div className="sub">{sub}</div></div>
      </div>
      <div className="topbar-right">
        <div className="search-box">🔍 <input placeholder="Search anything..." value={search} onChange={e=>setSearch(e.target.value)} /></div>
        <div className="icon-btn">🔔<span className="badge">{lowStockCount}</span></div>
        <div className="avatar" style={{width:36,height:36,fontSize:13}}>AD</div>
      </div>
    </div>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard({summary, sales, lowStockProducts, timeframeProfit, clients, trendRange, setTrendRange}){
  const stats = [
    {icon:'💰',cls:'',label:'Total Sales',value:fmt(summary.totalSales)},
    {icon:'📈',cls:'green',label:'Total Profit',value:fmt(summary.totalProfit)},
    {icon:'📦',cls:'teal',label:'Stock Units',value:summary.totalStock},
    {icon:'👥',cls:'',label:'Total Clients',value:summary.totalClients},
    {icon:'⏳',cls:'orange',label:'Pending Payments',value:fmt(summary.pendingPayments)},
    {icon:'⚠️',cls:'red',label:'Low Stock Items',value:summary.lowStockCount},
  ];

  const tfLabels = {'24h':'Last 24 Hours','7d':'Last 7 Days','1m':'Last 1 Month','6m':'Last 6 Months'};

  let labels=[], salesData=[], profitData=[];
  for(let i=trendRange-1;i>=0;i--){
    const d = new Date(Date.now()-i*86400000);
    const key = d.toISOString().slice(0,10);
    labels.push(d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}));
    const daySales = sales.filter(s=>s.created_at.slice(0,10)===key);
    salesData.push(daySales.reduce((a,s)=>a+Number(s.total),0));
    profitData.push(daySales.reduce((a,s)=>a+(Number(s.total)-Number(s.cost)),0));
  }

  const statuses = ['Paid','Pending','Partial'];
  const statusCounts = statuses.map(st=>sales.filter(x=>x.status===st).length);

  const recent = [...sales].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,6);

  return (
    <section className="section">
      <div className="stats-grid">
        {stats.map((s,i)=>(
          <div className={"stat-card "+s.cls} key={i}>
            <div className="stat-top"><div className="stat-icon">{s.icon}</div></div>
            <div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-head"><div><h3>💹 Profit by Time Range</h3><div className="sub-text">Live from database</div></div></div>
        <div className="timeframe-grid">
          {Object.entries(timeframeProfit).map(([key, val])=>(
            <div className="tf-card" key={key}>
              <div className="tf-label">{tfLabels[key]}</div>
              <div className="tf-value">{fmt(val.profit)}</div>
              <div className="tf-sub">{val.count} sale(s) · Revenue {fmt(val.revenue)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <div><h3>Sales & Profit Trend</h3><div className="sub-text">Daily performance</div></div>
            <select value={trendRange} onChange={e=>setTrendRange(Number(e.target.value))}>
              <option value={7}>Last 7 Days</option><option value={30}>Last 30 Days</option>
            </select>
          </div>
          <ChartCanvas type="line" data={{labels, datasets:[
            {label:'Sales',data:salesData,borderColor:'#2f5ef7',backgroundColor:'rgba(47,94,247,.08)',fill:true,tension:.35},
            {label:'Profit',data:profitData,borderColor:'#00c2b2',backgroundColor:'rgba(0,194,178,.08)',fill:true,tension:.35}
          ]}} options={{responsive:true,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true}}}} />
        </div>
        <div className="panel">
          <div className="panel-head"><div><h3>Payment Status</h3><div className="sub-text">Sales by payment state</div></div></div>
          <ChartCanvas type="doughnut" data={{labels:statuses,datasets:[{data:statusCounts,backgroundColor:['#22c55e','#ffab2e','#2f5ef7']}]}}
            options={{responsive:true,plugins:{legend:{position:'bottom'}},cutout:'65%'}} />
        </div>
      </div>

      <div className="grid-2b">
        <div className="panel">
          <div className="panel-head"><div><h3>⚠️ Low Stock Products</h3></div></div>
          <div className="table-wrap"><table><thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Status</th></tr></thead>
            <tbody>
              {lowStockProducts.length? lowStockProducts.map(p=>(
                <tr key={p.id}><td className="cell-main">{p.name}</td><td>{p.category}</td><td>{p.stock}</td><td><span className="tag low">Low Stock</span></td></tr>
              )) : <tr><td colSpan="4" className="empty-state">All stock levels healthy ✅</td></tr>}
            </tbody>
          </table></div>
        </div>
        <div className="panel">
          <div className="panel-head"><div><h3>🕑 Recent Sales</h3></div></div>
          <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {recent.map(s=>{
                const c = clients.find(x=>x.id===s.client_id);
                return <tr key={s.id}><td className="cell-main">{s.invoice_no}</td><td>{c?c.name:'—'}</td><td>{fmt(s.total)}</td><td><span className={"tag "+s.status.toLowerCase()}>{s.status}</span></td></tr>;
              })}
            </tbody>
          </table></div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Products Section ---------- */
function ProductsSection({products, filter, setFilter, search, onAdd, onEdit, onDelete}){
  const categories = [...new Set(products.map(p=>p.category))];
  let list = filter? products.filter(p=>p.category===filter): products;
  if(search) list = list.filter(p=>JSON.stringify(p).toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="section">
      <div className="panel">
        <div className="panel-head">
          <div><h3>Product & Inventory</h3><div className="sub-text">Manage catalog, stock and pricing</div></div>
          <div className="filters">
            <select value={filter} onChange={e=>setFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn btn-primary" onClick={onAdd}>+ Add Product</button>
          </div>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Product</th><th>Category</th><th>Purchase Price</th><th>Selling Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {list.length? list.map(p=>{
              const low = p.stock<=p.threshold;
              return (
                <tr key={p.id}>
                  <td className="cell-main">{p.name}</td><td>{p.category}</td>
                  <td>{fmt(p.purchase_price)}</td><td>{fmt(p.selling_price)}</td><td>{p.stock}</td>
                  <td><span className={"tag "+(low?"low":"ok")}>{low?"Low Stock":"In Stock"}</span></td>
                  <td className="row-actions">
                    <button className="btn-icon" onClick={()=>onEdit(p)}>✏️</button>
                    <button className="btn-icon" onClick={()=>onDelete(p.id)}>🗑️</button>
                  </td>
                </tr>
              );
            }) : <tr><td colSpan="7" className="empty-state">No products found</td></tr>}
          </tbody>
        </table></div>
      </div>
    </section>
  );
}

/* ---------- Clients Section ---------- */
function ClientsSection({clients, search, clientStats, onAdd, onEdit, onDelete}){
  let list = clients;
  if(search) list = list.filter(c=>JSON.stringify(c).toLowerCase().includes(search.toLowerCase()));

  const formatCnic = cnic => cnic ? `${cnic.slice(0,5)}-${cnic.slice(5,12)}-${cnic.slice(12)}` : '—';

  return (
    <section className="section">
      <div className="panel">
        <div className="panel-head">
          <div><h3>Clients</h3><div className="sub-text">Every client has a unique 13-digit ID card (CNIC) number</div></div>
          <button className="btn btn-primary" onClick={onAdd}>+ Add Client</button>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Client</th><th>ID Card No. (CNIC)</th><th>Contact</th><th>Orders</th><th>Total Spent</th><th>Balance Due</th><th>Actions</th></tr></thead>
          <tbody>
            {list.map(c=>{
              const st = clientStats(c.id);
              return (
                <tr key={c.id}>
                  <td className="cell-main">{c.name}<div className="cell-sub">{c.address||''}</div></td>
                  <td>{formatCnic(c.cnic)}</td>
                  <td>{c.phone}<div className="cell-sub">{c.email||''}</div></td>
                  <td>{st.orders}</td><td>{fmt(st.totalSpent)}</td>
                  <td>{st.balanceDue>0? <span className="tag pending">{fmt(st.balanceDue)}</span> : <span className="tag paid">Clear</span>}</td>
                  <td className="row-actions">
                    <button className="btn-icon" onClick={()=>onEdit(c)}>✏️</button>
                    <button className="btn-icon" onClick={()=>onDelete(c.id)}>🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
    </section>
  );
}

/* ---------- Sales Section ---------- */
function SalesSection({sales, clients, search, statusFilter, setStatusFilter, onNew, onView, onPay}){
  let list = statusFilter? sales.filter(s=>s.status===statusFilter): sales;
  list = [...list].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  if(search) list = list.filter(s=>JSON.stringify(s).toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="section">
      <div className="panel">
        <div className="panel-head">
          <div><h3>Sales & Invoice History</h3><div className="sub-text">Create and manage sales invoices</div></div>
          <div className="filters">
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="">All Status</option><option value="Paid">Paid</option><option value="Pending">Pending</option><option value="Partial">Partial</option>
            </select>
            <button className="btn btn-primary" onClick={onNew}>+ New Sale</button>
          </div>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Invoice #</th><th>Client</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {list.length? list.map(s=>{
              const client = clients.find(c=>c.id===s.client_id);
              return (
                <tr key={s.id}>
                  <td className="cell-main">{s.invoice_no}</td><td>{client?client.name:'—'}</td><td>{s.created_at.slice(0,10)}</td>
                  <td>{(s.items||[]).length} item(s)</td><td>{fmt(s.total)}</td>
                  <td><span className={"tag "+s.payment_method.toLowerCase()}>{s.payment_method}</span></td>
                  <td><span className={"tag "+s.status.toLowerCase()}>{s.status}</span></td>
                  <td className="row-actions">
                    <button className="btn-icon" onClick={()=>onView(s)}>👁️</button>
                    {s.status!=='Paid' && <button className="btn-icon" onClick={()=>onPay(s)}>💳</button>}
                  </td>
                </tr>
              );
            }) : <tr><td colSpan="8" className="empty-state">No sales found</td></tr>}
          </tbody>
        </table></div>
      </div>
    </section>
  );
}

/* ---------- Payments Section ---------- */
function PaymentsSection({sales, clients, paymentSummary, statusFilter, setStatusFilter, onPay}){
  const stats = [
    {icon:'✅',cls:'green',label:'Total Collected',value:fmt(paymentSummary.collected)},
    {icon:'⏳',cls:'orange',label:'Pending Amount',value:fmt(paymentSummary.pending)},
    {icon:'🔸',cls:'',label:'Partial Balance Due',value:fmt(paymentSummary.partial)},
  ];
  let list = statusFilter? sales.filter(s=>s.status===statusFilter): sales;

  return (
    <section className="section">
      <div className="stats-grid">
        {stats.map((s,i)=>(
          <div className={"stat-card "+s.cls} key={i}>
            <div className="stat-top"><div className="stat-icon">{s.icon}</div></div>
            <div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="panel-head">
          <div><h3>Payment Records</h3><div className="sub-text">Track paid, pending & partial payments</div></div>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="">All</option><option value="Paid">Paid</option><option value="Pending">Pending</option><option value="Partial">Partial</option>
          </select>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Invoice #</th><th>Client</th><th>Total</th><th>Paid</th><th>Remaining</th><th>Method</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {list.map(s=>{
              const client = clients.find(c=>c.id===s.client_id);
              return (
                <tr key={s.id}>
                  <td className="cell-main">{s.invoice_no}</td><td>{client?client.name:'—'}</td>
                  <td>{fmt(s.total)}</td><td>{fmt(s.paid)}</td><td>{fmt(s.remaining)}</td>
                  <td><span className={"tag "+s.payment_method.toLowerCase()}>{s.payment_method}</span></td>
                  <td><span className={"tag "+s.status.toLowerCase()}>{s.status}</span></td>
                  <td>{s.status!=='Paid'? <button className="btn btn-sm btn-primary" onClick={()=>onPay(s)}>Record</button> : <span className="cell-sub">Settled</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
    </section>
  );
}

/* ---------- Reports Section ---------- */
function ReportsSection({profitByProduct, profitByCustomer, summary, timeframeProfit}){
  const tfLabels = {'24h':'Last 24 Hours','7d':'Last 7 Days','1m':'Last 1 Month','6m':'Last 6 Months'};

  return (
    <section className="section">
      <div className="panel">
        <div className="panel-head"><div><h3>Business Reports</h3><div className="sub-text">Profit & margin analysis by product, customer and time period</div></div></div>
        <div className="timeframe-grid">
          {Object.entries(timeframeProfit).map(([key, val])=>(
            <div className="tf-card" key={key}>
              <div className="tf-label">{tfLabels[key]}</div>
              <div className="tf-value">{fmt(val.profit)}</div>
              <div className="tf-sub">Revenue {fmt(val.revenue)} · Cost {fmt(val.cost)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid-2b">
        <div className="panel">
          <div className="panel-head"><h3>Profit by Product</h3></div>
          <ChartCanvas type="bar" data={{labels:profitByProduct.map(e=>e.name),datasets:[{label:'Profit',data:profitByProduct.map(e=>Number(e.profit)),backgroundColor:'#2f5ef7',borderRadius:6}]}}
            options={{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}} height={240} />
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Profit by Customer</h3></div>
          <ChartCanvas type="bar" data={{labels:profitByCustomer.map(e=>e.client_name),datasets:[{label:'Profit',data:profitByCustomer.map(e=>Number(e.profit)),backgroundColor:'#00c2b2',borderRadius:6}]}}
            options={{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true}}}} height={240} />
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><h3>Revenue vs Cost vs Profit</h3></div>
        <ChartCanvas type="bar" data={{labels:['Revenue','Cost','Profit'],datasets:[{data:[summary.totalSales, summary.totalSales-summary.totalProfit, summary.totalProfit],backgroundColor:['#2f5ef7','#ff4d5e','#22c55e'],borderRadius:8}]}}
          options={{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}} height={220} />
      </div>
    </section>
  );
}

/* ---------- Product Modal ---------- */
function ProductModal({product, categories, onSave, onClose}){
  const [form, setForm] = useState(product ? {
    name: product.name, category: product.category, stock: product.stock,
    purchase_price: product.purchase_price, selling_price: product.selling_price, threshold: product.threshold
  } : {name:'',category:'',stock:0,purchase_price:0,selling_price:0,threshold:5});
  const [saving, setSaving] = useState(false);
  const set = (k,v)=>setForm({...form,[k]:v});
  const submit = async () => {
    if(!form.name.trim()){ alert('Product name required'); return; }
    setSaving(true);
    try {
      await onSave({...form, stock:Number(form.stock)||0, purchase_price:Number(form.purchase_price)||0, selling_price:Number(form.selling_price)||0, threshold:Number(form.threshold)||5, category: form.category||'Uncategorized'}, product?product.id:null);
    } catch(err){ alert(err.message); }
    setSaving(false);
  };
  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-head"><h3>{product?'Edit Product':'Add Product'}</h3><div className="modal-close" onClick={onClose}>✕</div></div>
        <div className="modal-body">
          <div className="form-group"><label>Product Name</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Wireless Mouse" /></div>
          <div className="form-row">
            <div className="form-group"><label>Category</label><input list="catList" value={form.category} onChange={e=>set('category',e.target.value)} placeholder="e.g. Electronics" />
              <datalist id="catList">{categories.map(c=><option key={c} value={c} />)}</datalist>
            </div>
            <div className="form-group"><label>Stock Quantity</label><input type="number" value={form.stock} onChange={e=>set('stock',e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Purchase Price (Rs)</label><input type="number" value={form.purchase_price} onChange={e=>set('purchase_price',e.target.value)} /></div>
            <div className="form-group"><label>Selling Price (Rs)</label><input type="number" value={form.selling_price} onChange={e=>set('selling_price',e.target.value)} /></div>
          </div>
          <div className="form-group"><label>Low Stock Alert Threshold</label><input type="number" value={form.threshold} onChange={e=>set('threshold',e.target.value)} /></div>
        </div>
        <div className="modal-footer"><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={saving}>{saving?'Saving...':'Save Product'}</button></div>
      </div>
    </div>
  );
}

/* ---------- Client Modal ---------- */
function ClientModal({client, onSave, onClose}){
  const [form, setForm] = useState(client || {name:'',phone:'',email:'',address:'',cnic:''});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k,v)=>setForm({...form,[k]:v});

  const submit = async () => {
    if(!form.name.trim()){ alert('Client name required'); return; }
    const cnicDigits = form.cnic.replace(/\D/g,'');
    if(cnicDigits.length !== 13){ setError('ID card number must be exactly 13 digits.'); return; }
    setError(''); setSaving(true);
    try {
      await onSave({...form, cnic:cnicDigits}, client?client.id:null);
    } catch(err){ setError(err.message); }
    setSaving(false);
  };

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-head"><h3>{client?'Edit Client':'Add Client'}</h3><div className="modal-close" onClick={onClose}>✕</div></div>
        <div className="modal-body">
          <div className="form-group"><label>Full Name</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Ahmed Traders" /></div>
          <div className="form-group">
            <label>ID Card Number (CNIC — 13 digits, unique)</label>
            <input value={form.cnic} maxLength={13} onChange={e=>set('cnic', e.target.value.replace(/\D/g,''))} placeholder="e.g. 3520112345671" />
            {error && <div className="field-error">{error}</div>}
          </div>
          <div className="form-row">
            <div className="form-group"><label>Phone Number</label><input value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="03xx-xxxxxxx" /></div>
            <div className="form-group"><label>Email</label><input value={form.email} onChange={e=>set('email',e.target.value)} placeholder="client@email.com" /></div>
          </div>
          <div className="form-group"><label>Address</label><textarea rows="2" value={form.address} onChange={e=>set('address',e.target.value)} placeholder="City, area..."></textarea></div>
        </div>
        <div className="modal-footer"><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={saving}>{saving?'Saving...':'Save Client'}</button></div>
      </div>
    </div>
  );
}

/* ---------- Sale Modal ---------- */
function SaleModal({products, clients, onSave, onClose}){
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [items, setItems] = useState([{productId: products[0]?.id || '', qty:1}]);
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [saving, setSaving] = useState(false);

  const addRow = () => setItems([...items, {productId: products[0]?.id||'', qty:1}]);
  const removeRow = idx => setItems(items.filter((_,i)=>i!==idx));
  const updateRow = (idx, key, value) => setItems(items.map((it,i)=> i===idx? {...it,[key]:value}: it));

  let subtotal = 0;
  items.forEach(it=>{
    const prod = products.find(p=>p.id===Number(it.productId));
    if(prod) subtotal += Number(prod.selling_price) * Number(it.qty||0);
  });
  const grand = Math.max(subtotal - Number(discount||0), 0);
  const paidNow = Math.min(Number(amountPaid||0), grand);
  let status = 'Pending';
  if(paidNow>=grand && grand>0) status='Paid'; else if(paidNow>0) status='Partial';

  const submit = async () => {
    if(!clientId){ alert('Select a client'); return; }
    if(items.length===0){ alert('Add at least one product'); return; }
    setSaving(true);
    try {
      await onSave({
        client_id: Number(clientId),
        items: items.map(it => ({ product_id: Number(it.productId), qty: Number(it.qty) })),
        discount: Number(discount||0),
        amount_paid: Number(amountPaid||0),
        payment_method: paymentMethod
      });
    } catch(err){ alert(err.message); setSaving(false); }
  };

  return (
    <div className="overlay">
      <div className="modal" style={{width:640}}>
        <div className="modal-head"><h3>Create New Sale</h3><div className="modal-close" onClick={onClose}>✕</div></div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group"><label>Client</label>
              <select value={clientId} onChange={e=>setClientId(e.target.value)}>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Payment Method</label>
              <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>
                <option>Cash</option><option>Card</option><option>Credit</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label>Products</label>
            <div className="sale-items-box">
              {items.map((it,idx)=>{
                const prod = products.find(p=>p.id===Number(it.productId));
                const lineTotal = prod? Number(prod.selling_price)*Number(it.qty||0): 0;
                return (
                  <div className="sale-item-row" key={idx}>
                    <select value={it.productId} onChange={e=>updateRow(idx,'productId',e.target.value)}>
                      {products.map(p=><option key={p.id} value={p.id}>{p.name} ({fmt(p.selling_price)})</option>)}
                    </select>
                    <input type="number" min="1" value={it.qty} onChange={e=>updateRow(idx,'qty',e.target.value)} />
                    <input type="text" disabled value={fmt(lineTotal)} />
                    <button className="btn-icon" onClick={()=>removeRow(idx)}>🗑️</button>
                  </div>
                );
              })}
            </div>
            <button className="btn btn-outline btn-sm" onClick={addRow}>+ Add Product Line</button>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Discount (Rs)</label><input type="number" value={discount} onChange={e=>setDiscount(e.target.value)} /></div>
            <div className="form-group"><label>Amount Paid Now (Rs)</label><input type="number" value={amountPaid} onChange={e=>setAmountPaid(e.target.value)} /></div>
          </div>
          <div className="sale-total-box">
            <div className="row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="row"><span>Discount</span><span>{fmt(discount)}</span></div>
            <div className="row grand"><span>Grand Total</span><span>{fmt(grand)}</span></div>
            <div className="row"><span>Status</span><span className={"tag "+status.toLowerCase()}>{status}</span></div>
          </div>
        </div>
        <div className="modal-footer"><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={saving}>{saving?'Saving...':'Generate Invoice'}</button></div>
      </div>
    </div>
  );
}

/* ---------- Invoice Modal ---------- */
function InvoiceModal({sale, client, onClose}){
  return (
    <div className="overlay">
      <div className="modal" style={{width:600}}>
        <div className="modal-head"><h3>Invoice Details</h3><div className="modal-close" onClick={onClose}>✕</div></div>
        <div className="modal-body">
          <div className="invoice-preview">
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:18}}>
              <div><h2>GerlyMaster</h2><div style={{color:'var(--text-muted)',fontSize:12.5}}>Business Management Invoice</div></div>
              <div style={{textAlign:'right'}}><b>{sale.invoice_no}</b><div style={{fontSize:12,color:'var(--text-muted)'}}>{(sale.created_at||'').slice(0,10)}</div></div>
            </div>
            <div style={{marginBottom:14,fontSize:13}}><b>Bill To:</b> {client?client.name:'—'}<br/>{client?client.phone:''}</div>
            <table style={{width:'100%',borderCollapse:'collapse',marginBottom:14}}>
              <thead><tr style={{background:'var(--bg)'}}><th style={{padding:8,textAlign:'left'}}>Product</th><th style={{padding:8}}>Qty</th><th style={{padding:8}}>Price</th><th style={{padding:8}}>Total</th></tr></thead>
              <tbody>{(sale.items||[]).map((i,idx)=>(
                <tr key={idx}><td style={{padding:8}}>{i.name}</td><td style={{padding:8,textAlign:'center'}}>{i.qty}</td><td style={{padding:8,textAlign:'right'}}>{fmt(i.price)}</td><td style={{padding:8,textAlign:'right'}}>{fmt(i.price*i.qty)}</td></tr>
              ))}</tbody>
            </table>
            <div style={{textAlign:'right',fontSize:13}}>
              <div>Subtotal: {fmt(sale.subtotal)}</div>
              <div>Discount: -{fmt(sale.discount)}</div>
              <div style={{fontWeight:800,fontSize:16,marginTop:4}}>Total: {fmt(sale.total)}</div>
              <div style={{marginTop:6}}>Paid: {fmt(sale.paid)} &nbsp;|&nbsp; Remaining: {fmt(sale.remaining)}</div>
              <span className={"tag "+sale.status.toLowerCase()} style={{marginTop:8,display:'inline-block'}}>{sale.status}</span>
            </div>
          </div>
        </div>
        <div className="modal-footer"><button className="btn btn-outline" onClick={()=>window.print()}>🖨 Print</button><button className="btn btn-primary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

/* ---------- Payment Modal ---------- */
function PayModal({sale, onConfirm, onClose}){
  const [amount, setAmount] = useState('');
  const submit = () => {
    const amt = Number(amount)||0;
    if(amt<=0){ alert('Enter a valid amount'); return; }
    onConfirm(sale.id, amt);
  };
  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-head"><h3>Record Payment</h3><div className="modal-close" onClick={onClose}>✕</div></div>
        <div className="modal-body">
          <div className="form-group"><label>Remaining Amount</label><input disabled value={fmt(sale.remaining)} /></div>
          <div className="form-group"><label>Amount Receiving Now (Rs)</label><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" /></div>
        </div>
        <div className="modal-footer"><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit}>Confirm Payment</button></div>
      </div>
    </div>
  );
}

/* ---------- Mount ---------- */
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);