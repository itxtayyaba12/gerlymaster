const { useState, useEffect, useRef } = React;

const API_BASE = 'http://localhost:5000/api';
const ROLE_KEY = 'gerlymaster_role';
const fmt = n => 'Rs ' + Number(n || 0).toLocaleString('en-PK');
const FIXED_CATEGORIES = ['Electronics','Stationery','Groceries','Clothing','Furniture'];

async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

/* ---------- Error Boundary (prevents blank white screen on render errors) ---------- */
class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(error, info){ console.error('GerlyMaster crashed:', error, info); }
  render(){
    if (this.state.error) {
      return (
        <div style={{padding:40, maxWidth:640, fontFamily:'sans-serif'}}>
          <h2 style={{marginBottom:10}}>⚠️ Something went wrong</h2>
          <p style={{color:'#666', marginBottom:14}}>
            The app hit an unexpected error while rendering. Details below (check console for full trace):
          </p>
          <pre style={{background:'#f5f5f5', padding:12, borderRadius:8, whiteSpace:'pre-wrap', fontSize:12.5}}>
            {String(this.state.error && this.state.error.message || this.state.error)}
          </pre>
          <button
            style={{marginTop:16, padding:'8px 16px', borderRadius:8, border:'none', background:'#2f5ef7', color:'#fff', cursor:'pointer'}}
            onClick={() => this.setState({ error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
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

/* ---------- Login Gate (simple role-based demo login) ---------- */
function LoginGate({ onLogin }) {
  const [role, setRole] = useState('admin');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const PASSCODES = { admin: 'admin123', administration: 'staff123' };

  const submit = () => {
    if (passcode !== PASSCODES[role]) { setError('Incorrect passcode.'); return; }
    localStorage.setItem(ROLE_KEY, role);
    onLogin(role);
  };

  return (
    <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)'}}>
      <div className="panel" style={{width:380}}>
        <div style={{textAlign:'center', marginBottom:20}}>
          <div style={{width:48,height:48,borderRadius:12,background:'linear-gradient(135deg,var(--primary),var(--accent))',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:22,color:'#fff',margin:'0 auto 10px'}}>G</div>
          <h2 style={{fontSize:20}}>GerlyMaster</h2>
          <div className="sub-text">Sign in to continue</div>
        </div>
        <div className="form-group">
          <label>Role</label>
          <select value={role} onChange={e=>{setRole(e.target.value); setError('');}}>
            <option value="admin">Admin</option>
<option value="administration">Staff</option>
          </select>
        </div>
        <div className="form-group">
          <label>Passcode</label>
          <input type="password" value={passcode} onChange={e=>{setPasscode(e.target.value); setError('');}}
            placeholder="Enter passcode" onKeyDown={e=>e.key==='Enter' && submit()} />
          {error && <div className="field-error">{error}</div>}
        </div>
        <button className="btn btn-primary" style={{width:'100%', justifyContent:'center'}} onClick={submit}>Sign In</button>
      </div>
    </div>
  );
}

/* ---------- Delete Reason Modal (for Administration role) ---------- */
function DeleteReasonModal({ label, onConfirm, onCancel }) {
  const [note, setNote] = useState('');
  const submit = () => {
    if (!note.trim()) { alert('Please enter a reason for this deletion.'); return; }
    onConfirm(note);
  };
  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-head"><h3>Delete {label}</h3><div className="modal-close" onClick={onCancel}>✕</div></div>
        <div className="modal-body">
          <p style={{fontSize:13, color:'var(--text-muted)', marginBottom:14}}>
            Please provide a reason for this deletion. This will be recorded for the admin's review only.
          </p>
          <div className="form-group">
            <label>Reason for Deletion</label>
            <textarea rows="3" value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Duplicate entry, customer request, data entry error..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn" style={{background:'var(--danger)', color:'#fff'}} onClick={submit}>Confirm Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Main App ---------- */
function App(){
  const [role, setRole] = useState(() => localStorage.getItem(ROLE_KEY) || null);
  const isAdmin = role === 'admin';

  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [sales, setSales] = useState([]);
  // NOTE: these now start as safe empty-shape objects instead of null.
  // Previously they started as `null`, and because fetchAll() only flips
  // `loading` to true *after* the login click causes a re-render, the
  // Dashboard could try to render with `summary === null` for one frame
  // (e.g. `summary.totalSales`) and crash the whole tree -> blank screen.
  const [summary, setSummary] = useState({
    totalSales:0, totalProfit:0, totalStock:0, totalClients:0, pendingPayments:0, lowStockCount:0
  });
  const [timeframeProfit, setTimeframeProfit] = useState({
    '24h':{profit:0,revenue:0,cost:0,count:0},
    '7d':{profit:0,revenue:0,cost:0,count:0},
    '1m':{profit:0,revenue:0,cost:0,count:0},
    '6m':{profit:0,revenue:0,cost:0,count:0},
  });
  const [profitByProduct, setProfitByProduct] = useState([]);
  const [profitByCustomer, setProfitByCustomer] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState({ collected:0, pending:0, partial:0 });
  const [auditLogs, setAuditLogs] = useState([]);

  // Start "loading" whenever we already have a role (e.g. page refresh with
  // a saved session), so the very first render doesn't try to paint the
  // dashboard/products/etc before real data has arrived.
  const [loading, setLoading] = useState(() => !!localStorage.getItem(ROLE_KEY));
  const [connError, setConnError] = useState('');

  const [activeSection, setActiveSection] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');

  const [productModal, setProductModal] = useState(null);
  const [productDetail, setProductDetail] = useState(null);
  const [clientModal, setClientModal] = useState(null);
  const [viewingClientId, setViewingClientId] = useState(null);
  const [saleModal, setSaleModal] = useState(false);
  const [invoiceView, setInvoiceView] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [deleteRequest, setDeleteRequest] = useState(null); // { label, onConfirm(note) }

  const [prodCategoryFilter, setProdCategoryFilter] = useState('');
  const [saleStatusFilter, setSaleStatusFilter] = useState('');
  const [payStatusFilter, setPayStatusFilter] = useState('');
  const [trendRange, setTrendRange] = useState(7);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setConnError('');
      const [p, c, s, sum, tf, pbp, pbc, paySum, logs] = await Promise.all([
        apiFetch('/products'),
        apiFetch('/clients'),
        apiFetch('/sales'),
        apiFetch('/reports/dashboard-summary'),
        apiFetch('/reports/profit-by-timeframe'),
        apiFetch('/reports/profit-by-product'),
        apiFetch('/reports/profit-by-customer'),
        apiFetch('/payments/summary'),
        apiFetch('/audit/deletions'),
      ]);
      setProducts(p); setClients(c); setSales(s);
      setSummary(sum); setTimeframeProfit(tf);
      setProfitByProduct(pbp); setProfitByCustomer(pbc);
      setPaymentSummary(paySum); setAuditLogs(logs);
    } catch (err) {
      setConnError('Unable to connect to the backend. Please check that the Express server (localhost:5000) is running. Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (role) fetchAll(); }, [role]);

  const titles = {
    dashboard:['Dashboard',"Welcome back, here's your business overview"],
    products:['Product & Inventory','Manage your catalog and stock levels'],
    clients:['Clients','Manage client relationships and history'],
    sales:['Sales & Invoices','Create sales and track invoice history'],
    payments:['Payments','Track paid, pending and partial payments'],
    reports:['Reports & Analytics','Profit and margin insights across your business'],
    audit:['Deletion Log','All deletions made by Administration staff'],
  };

  const lowStockProducts = products.filter(p => p.stock <= p.threshold);
  const viewingClient = viewingClientId ? clients.find(c => c.id === viewingClientId) : null;

  const clientStats = clientId => {
    const clientSales = sales.filter(s => s.client_id === clientId);
    return {
      orders: clientSales.length,
      totalSpent: clientSales.reduce((a,s)=>a+Number(s.total),0),
      balanceDue: clientSales.reduce((a,s)=>a+Number(s.remaining),0),
    };
  };

  /* ---------- Unified delete confirmation (role-aware) ---------- */
  const askDelete = (type, name, action) => {
    if (isAdmin) {
      if (window.confirm(`Delete this ${type} — "${name}"?`)) action(null);
    } else {
      setDeleteRequest({
        label: `${type} "${name}"`,
        onConfirm: (note) => { setDeleteRequest(null); action(note); }
      });
    }
  };

  /* ---------- API-backed CRUD ---------- */
  const saveProduct = async (data, id) => {
    if (id) await apiFetch(`/products/${id}`, { method:'PUT', body: JSON.stringify(data) });
    else await apiFetch('/products', { method:'POST', body: JSON.stringify(data) });
    await fetchAll();
    setProductModal(null);
  };
  const deleteProduct = async (id, note) => {
    try { await apiFetch(`/products/${id}`, { method:'DELETE', body: JSON.stringify({ role, note }) }); await fetchAll(); }
    catch(err){ alert(err.message); }
  };

  const saveClient = async (data, id) => {
    if (id) await apiFetch(`/clients/${id}`, { method:'PUT', body: JSON.stringify(data) });
    else await apiFetch('/clients', { method:'POST', body: JSON.stringify(data) });
    await fetchAll();
    setClientModal(null);
  };
  const createClientInline = async (data) => {
    const newClient = await apiFetch('/clients', { method:'POST', body: JSON.stringify(data) });
    return newClient;
  };
  const deleteClient = async (id, note) => {
    try { await apiFetch(`/clients/${id}`, { method:'DELETE', body: JSON.stringify({ role, note }) }); await fetchAll(); }
    catch(err){ alert(err.message); }
  };

  const saveSale = async (payload) => {
    const newSale = await apiFetch('/sales', { method:'POST', body: JSON.stringify(payload) });
    await fetchAll();
    setSaleModal(false);
    setInvoiceView(newSale);
  };
  const deleteSale = async (id, note) => {
    try { await apiFetch(`/sales/${id}`, { method:'DELETE', body: JSON.stringify({ role, note }) }); await fetchAll(); }
    catch(err){ alert(err.message); }
  };

  const confirmPayment = async (saleId, amt) => {
    try {
      await apiFetch(`/payments/${saleId}/pay`, { method:'POST', body: JSON.stringify({ amount: amt }) });
      await fetchAll();
      setPayModal(null);
    } catch(err){ alert(err.message); }
  };

  const handleLogout = () => {
    localStorage.removeItem(ROLE_KEY);
    setRole(null);
  };

  if (!role) {
    return <LoginGate onLogin={(r) => {
      // Flip loading on in the SAME event as setting the role, so the next
      // render shows the "Loading..." screen instead of trying to paint
      // Dashboard/Products/etc before fetchAll() has actually populated data.
      setLoading(true);
      setRole(r);
      setActiveSection(r==='admin' ? 'dashboard' : 'products');
    }} />;
  }

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
      <Sidebar active={activeSection} setActive={s=>{setActiveSection(s); setSidebarOpen(false); setViewingClientId(null);}} open={sidebarOpen} role={role} />
      <div className="main">
        {viewingClient ? (
          <ClientDetailPage client={viewingClient} onBack={()=>setViewingClientId(null)} />
        ) : (
          <>
            <Topbar
              title={titles[activeSection][0]} sub={titles[activeSection][1]}
              search={search} setSearch={setSearch}
              lowStockCount={lowStockProducts.length}
              onToggleSidebar={()=>setSidebarOpen(!sidebarOpen)}
              role={role} onLogout={handleLogout}
            />
            <div className="content">
              {activeSection==='dashboard' && isAdmin &&
                <Dashboard summary={summary} sales={sales} lowStockProducts={lowStockProducts} timeframeProfit={timeframeProfit}
                  clients={clients} trendRange={trendRange} setTrendRange={setTrendRange} />}
              {activeSection==='products' &&
                <ProductsSection products={products} filter={prodCategoryFilter} setFilter={setProdCategoryFilter}
                  search={search} onAdd={()=>setProductModal('new')} onEdit={p=>setProductModal(p)}
                  onView={p=>setProductDetail(p)}
                  onDelete={p=>askDelete('product', p.name, note=>deleteProduct(p.id, note))} role={role} />}
              {activeSection==='clients' &&
                <ClientsSection clients={clients} search={search} clientStats={clientStats}
                  onAdd={()=>setClientModal('new')} onEdit={c=>setClientModal(c)}
                  onView={c=>setViewingClientId(c.id)}
                  onDelete={c=>askDelete('client', c.name, note=>deleteClient(c.id, note))} role={role} />}
              {activeSection==='sales' &&
                <SalesSection sales={sales} clients={clients} search={search} statusFilter={saleStatusFilter} setStatusFilter={setSaleStatusFilter}
                  onNew={()=>setSaleModal(true)} onView={s=>setInvoiceView(s)} onPay={s=>setPayModal(s)}
                  onDelete={s=>askDelete('invoice', s.invoice_no, note=>deleteSale(s.id, note))} role={role} />}
              {activeSection==='payments' && isAdmin &&
                <PaymentsSection sales={sales} clients={clients} paymentSummary={paymentSummary}
                  statusFilter={payStatusFilter} setStatusFilter={setPayStatusFilter} onPay={s=>setPayModal(s)} />}
              {activeSection==='reports' && isAdmin &&
                <ReportsSection profitByProduct={profitByProduct} profitByCustomer={profitByCustomer}
                  summary={summary} timeframeProfit={timeframeProfit} />}
              {activeSection==='audit' && isAdmin &&
                <AuditLogSection logs={auditLogs} />}
            </div>
          </>
        )}
      </div>

      {productModal && <ProductModal product={productModal==='new'?null:productModal}
        categories={[...new Set(products.map(p=>p.category))]}
        onSave={saveProduct} onClose={()=>setProductModal(null)} />}

      {productDetail && <ProductDetailModal product={productDetail} onClose={()=>setProductDetail(null)} />}

      {clientModal && <ClientModal client={clientModal==='new'?null:clientModal}
        onSave={saveClient} onClose={()=>setClientModal(null)} />}

      {saleModal && <SaleModal products={products} clients={clients} onCreateClient={createClientInline} onSave={saveSale} onClose={()=>setSaleModal(false)} />}

      {invoiceView && <InvoiceModal sale={invoiceView} client={clients.find(c=>c.id===invoiceView.client_id)} onClose={()=>setInvoiceView(null)} />}

      {payModal && <PayModal sale={payModal} onConfirm={confirmPayment} onClose={()=>setPayModal(null)} />}

      {deleteRequest && <DeleteReasonModal label={deleteRequest.label} onConfirm={deleteRequest.onConfirm} onCancel={()=>setDeleteRequest(null)} />}
    </div>
  );
}

/* ---------- Sidebar (role-aware) ---------- */
function Sidebar({active, setActive, open, role}){
  const isAdmin = role === 'admin';
  const items = [
    ...(isAdmin ? [{group:'Overview', list:[['dashboard','📊 Dashboard']]}] : []),
    {group:'Management', list:[
      ['products','📦 Products & Inventory'],
      ['clients','👥 Clients'],
      ['sales','🧾 Sales & Invoices'],
      ...(isAdmin ? [['payments','💳 Payments']] : [])
    ]},
    ...(isAdmin ? [{group:'Insights', list:[['reports','📈 Reports & Analytics'],['audit','🗂️ Deletion Log']]}] : []),
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
  <div className="avatar">{isAdmin?'AD':'ST'}</div>
  <div className="info"><b>{isAdmin?'Admin':'Staff'}</b></div>
</div>
    </aside>
  );
}

/* ---------- Topbar ---------- */
function Topbar({title, sub, search, setSearch, lowStockCount, onToggleSidebar, role, onLogout}){
  return (
    <div className="topbar">
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <button className="icon-btn mobile-toggle" onClick={onToggleSidebar}>☰</button>
        <div><h2>{title}</h2><div className="sub">{sub}</div></div>
      </div>
      <div className="topbar-right">
        <div className="search-box">🔍 <input placeholder="Search anything..." value={search} onChange={e=>setSearch(e.target.value)} /></div>
        {role==='admin' && <div className="icon-btn">🔔<span className="badge">{lowStockCount}</span></div>}
        <button className="btn btn-outline btn-sm" onClick={onLogout}>Logout</button>
        <div className="avatar" style={{width:36,height:36,fontSize:13}}>{role==='admin'?'AD':'ST'}</div>
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
    const daySales = sales.filter(s=> s.created_at && s.created_at.slice(0,10)===key);
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

/* ---------- Products Section (role-aware) ---------- */
function ProductsSection({products, filter, setFilter, search, onAdd, onEdit, onView, onDelete, role}){
  const categories = [...new Set(products.map(p=>p.category))];
  let list = filter? products.filter(p=>p.category===filter): products;
  if(search) list = list.filter(p=>JSON.stringify(p).toLowerCase().includes(search.toLowerCase()));

  return (
    <section className="section">
      <div className="panel">
        <div className="panel-head">
          <div><h3>Product & Inventory</h3><div className="sub-text">Manage catalog, stock and pricing — click a product name to see its sales history</div></div>
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
                  <td className="cell-main" style={{cursor:'pointer', color:'var(--primary)'}} onClick={()=>onView(p)}>{p.name}</td>
                  <td>{p.category}</td>
                  <td>{fmt(p.purchase_price)}</td><td>{fmt(p.selling_price)}</td><td>{p.stock}</td>
                  <td><span className={"tag "+(low?"low":"ok")}>{low?"Low Stock":"In Stock"}</span></td>
                  <td className="row-actions">
                    {role==='admin' && <button className="btn-icon" onClick={()=>onEdit(p)}>✏️</button>}
                    <button className="btn-icon" onClick={()=>onDelete(p)}>🗑️</button>
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

/* ---------- Product Detail Modal (sales history) ---------- */
function ProductDetailModal({ product, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/products/${product.id}/sales-history`)
      .then(setData)
      .catch(err => alert(err.message))
      .finally(() => setLoading(false));
  }, [product.id]);

  return (
    <div className="overlay">
      <div className="modal" style={{ width: 700 }}>
        <div className="modal-head">
          <h3>{product.name} — Sales History</h3>
          <div className="modal-close" onClick={onClose}>✕</div>
        </div>
        <div className="modal-body">
          {loading || !data ? (
            <div className="empty-state">Loading sales history...</div>
          ) : (
            <>
              <div className="stats-grid" style={{ marginBottom: 18 }}>
                <div className="stat-card">
                  <div className="stat-value">{data.totals.totalQty}</div>
                  <div className="stat-label">Total Units Sold</div>
                </div>
                <div className="stat-card green">
                  <div className="stat-value">{fmt(data.totals.totalRevenue)}</div>
                  <div className="stat-label">Total Revenue</div>
                </div>
                <div className="stat-card teal">
                  <div className="stat-value">{fmt(data.totals.totalProfit)}</div>
                  <div className="stat-label">Total Profit</div>
                </div>
                <div className="stat-card orange">
                  <div className="stat-value">{data.totals.totalOrders}</div>
                  <div className="stat-label">Total Orders</div>
                </div>
              </div>

              <h4 style={{ marginBottom: 10, fontSize: 14 }}>📅 Daily Sales — Last 30 Days</h4>
              {data.daily.length ? (
                <ChartCanvas type="line" height={180}
                  data={{
                    labels: data.daily.map(d => d.sale_date.slice(5)),
                    datasets: [{ label: 'Units Sold', data: data.daily.map(d => Number(d.qty)), borderColor: '#2f5ef7', backgroundColor: 'rgba(47,94,247,.08)', fill: true, tension: .35 }]
                  }}
                  options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
                />
              ) : <div className="empty-state">No sales in the last 30 days</div>}

              <h4 style={{ margin: '18px 0 10px', fontSize: 14 }}>📆 Yearly Sales — Last 5 Years</h4>
              <div className="table-wrap"><table>
                <thead><tr><th>Year</th><th>Units Sold</th><th>Revenue</th><th>Profit</th></tr></thead>
                <tbody>
                  {data.yearly.length ? data.yearly.map(y => (
                    <tr key={y.year}>
                      <td className="cell-main">{y.year}</td>
                      <td>{y.qty}</td>
                      <td>{fmt(y.revenue)}</td>
                      <td>{fmt(y.profit)}</td>
                    </tr>
                  )) : <tr><td colSpan="4" className="empty-state">No sales recorded yet</td></tr>}
                </tbody>
              </table></div>
            </>
          )}
        </div>
        <div className="modal-footer"><button className="btn btn-primary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

/* ---------- Clients Section (role-aware) ---------- */
function ClientsSection({clients, search, clientStats, onAdd, onEdit, onView, onDelete, role}){
  let list = clients;
  if(search) list = list.filter(c=>JSON.stringify(c).toLowerCase().includes(search.toLowerCase()));

  const formatCnic = cnic => cnic ? `${cnic.slice(0,5)}-${cnic.slice(5,12)}-${cnic.slice(12)}` : '—';

  return (
    <section className="section">
      <div className="panel">
        <div className="panel-head">
          <div><h3>Clients</h3><div className="sub-text">Click a client's name to see their full purchase history & profit</div></div>
          <button className="btn btn-primary" onClick={onAdd}>+ Add Client</button>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Client</th><th>ID Card No. (CNIC)</th><th>Contact</th><th>Orders</th><th>Total Spent</th><th>Balance Due</th><th>Actions</th></tr></thead>
          <tbody>
            {list.map(c=>{
              const st = clientStats(c.id);
              return (
                <tr key={c.id}>
                  <td className="cell-main" style={{cursor:'pointer', color:'var(--primary)'}} onClick={()=>onView(c)}>
                    {c.name}<div className="cell-sub">{c.address||''}</div>
                  </td>
                  <td>{formatCnic(c.cnic)}</td>
                  <td>{c.phone}<div className="cell-sub">{c.email||''}</div></td>
                  <td>{st.orders}</td><td>{fmt(st.totalSpent)}</td>
                  <td>{st.balanceDue>0? <span className="tag pending">{fmt(st.balanceDue)}</span> : <span className="tag paid">Clear</span>}</td>
                  <td className="row-actions">
                    {role==='admin' && <button className="btn-icon" onClick={()=>onEdit(c)}>✏️</button>}
                    <button className="btn-icon" onClick={()=>onDelete(c)}>🗑️</button>
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

/* ---------- Client Detail Page ---------- */
function ClientDetailPage({ client, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/clients/${client.id}/full-history`)
      .then(setData)
      .catch(err => alert(err.message))
      .finally(() => setLoading(false));
  }, [client.id]);

  const formatCnic = cnic => cnic ? `${cnic.slice(0,5)}-${cnic.slice(5,12)}-${cnic.slice(12)}` : '—';

  return (
    <>
      <div className="topbar">
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <button className="icon-btn" onClick={onBack} title="Back to Clients">←</button>
          <div>
            <h2>{client.name}</h2>
            <div className="sub">CNIC: {formatCnic(client.cnic)} · {client.phone}</div>
          </div>
        </div>
      </div>
      <div className="content">
        {loading || !data ? (
          <div className="empty-state">Loading client history...</div>
        ) : (
          <>
            <div className="stats-grid" style={{marginBottom:22}}>
              <div className="stat-card">
                <div className="stat-value">{data.totals.totalOrders}</div>
                <div className="stat-label">Total Orders</div>
              </div>
              <div className="stat-card teal">
                <div className="stat-value">{data.totals.totalItems}</div>
                <div className="stat-label">Total Items Purchased</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{fmt(data.totals.totalRevenue)}</div>
                <div className="stat-label">Total Revenue</div>
              </div>
              <div className="stat-card green">
                <div className="stat-value">{fmt(data.totals.totalProfit)}</div>
                <div className="stat-label">Total Profit From This Client</div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><div><h3>📅 Daily Purchases — Last 30 Days</h3></div></div>
              {data.daily.length ? (
                <ChartCanvas type="line" height={220}
                  data={{
                    labels: data.daily.map(d => d.sale_date.slice(5)),
                    datasets: [{ label: 'Items Bought', data: data.daily.map(d => Number(d.qty)), borderColor: '#2f5ef7', backgroundColor: 'rgba(47,94,247,.08)', fill: true, tension: .35 }]
                  }}
                  options={{ plugins: { legend: { position:'bottom' } }, scales: { y: { beginAtZero: true } } }}
                />
              ) : <div className="empty-state">No purchases in the last 30 days</div>}
            </div>

            <div className="panel">
              <div className="panel-head"><div><h3>📆 Yearly Summary — Last 5 Years</h3></div></div>
              <div className="table-wrap"><table>
                <thead><tr><th>Year</th><th>Items Purchased</th><th>Revenue</th><th>Profit</th></tr></thead>
                <tbody>
                  {data.yearly.length ? data.yearly.map(y => (
                    <tr key={y.year}>
                      <td className="cell-main">{y.year}</td>
                      <td>{y.qty}</td>
                      <td>{fmt(y.revenue)}</td>
                      <td>{fmt(y.profit)}</td>
                    </tr>
                  )) : <tr><td colSpan="4" className="empty-state">No purchases recorded yet</td></tr>}
                </tbody>
              </table></div>
            </div>

            <div className="panel">
              <div className="panel-head"><div><h3>🧾 Full Purchase History</h3><div className="sub-text">Every transaction — exact date, time, and items bought</div></div></div>
              <div className="table-wrap"><table>
                <thead><tr><th>Date & Time</th><th>Invoice #</th><th>Items Purchased</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  {data.transactions.length ? data.transactions.map(t => (
                    <tr key={t.id}>
                      <td className="cell-main">{new Date(t.created_at).toLocaleString('en-PK', {dateStyle:'medium', timeStyle:'short'})}</td>
                      <td>{t.invoice_no}</td>
                      <td>{(t.items||[]).map(i => `${i.name} ×${i.qty}`).join(', ')}</td>
                      <td>{fmt(t.total)}</td>
                      <td><span className={"tag "+t.status.toLowerCase()}>{t.status}</span></td>
                    </tr>
                  )) : <tr><td colSpan="5" className="empty-state">No transactions yet</td></tr>}
                </tbody>
              </table></div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ---------- Sales Section (role-aware) ---------- */
function SalesSection({sales, clients, search, statusFilter, setStatusFilter, onNew, onView, onPay, onDelete, role}){
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
                  <td className="cell-main">{s.invoice_no}</td><td>{client?client.name:'—'}</td><td>{(s.created_at||'').slice(0,10)}</td>
                  <td>{(s.items||[]).length} item(s)</td><td>{fmt(s.total)}</td>
                  <td><span className={"tag "+s.payment_method.toLowerCase()}>{s.payment_method}</span></td>
                  <td><span className={"tag "+s.status.toLowerCase()}>{s.status}</span></td>
                  <td className="row-actions">
                    <button className="btn-icon" onClick={()=>onView(s)}>👁️</button>
                    {role==='admin' && s.status!=='Paid' && <button className="btn-icon" onClick={()=>onPay(s)}>💳</button>}
                    <button className="btn-icon" onClick={()=>onDelete(s)}>🗑️</button>
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

/* ---------- Audit / Deletion Log Section (Admin only) ---------- */
function AuditLogSection({ logs }) {
  return (
    <section className="section">
      <div className="panel">
        <div className="panel-head">
          <div><h3>🗂️ Deletion Log</h3><div className="sub-text">All deletions made by Administration staff, with their reasons — visible to Admin only</div></div>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Date & Time</th><th>Type</th><th>Item</th><th>Deleted By</th><th>Reason</th></tr></thead>
          <tbody>
            {logs.length ? logs.map(l => (
              <tr key={l.id}>
                <td className="cell-main">{new Date(l.created_at).toLocaleString('en-PK', {dateStyle:'medium', timeStyle:'short'})}</td>
                <td><span className="tag pending" style={{textTransform:'capitalize'}}>{l.entity_type}</span></td>
                <td>{l.entity_name}</td>
                <td>{l.deleted_by}</td>
                <td>{l.note}</td>
              </tr>
            )) : <tr><td colSpan="5" className="empty-state">No deletions recorded yet</td></tr>}
          </tbody>
        </table></div>
      </div>
    </section>
  );
}

/* ---------- Reports Section (unchanged — your customized version) ---------- */
function ReportsSection({profitByProduct, profitByCustomer, summary, timeframeProfit}){
  const tfLabels = {'24h':'Last 24 Hours','7d':'Last 7 Days','1m':'Last 1 Month','6m':'Last 6 Months'};

  return (
    <section className="section">
      <div className="panel">
        <div className="panel-head"><div><h3>Business Reports</h3><div className="sub-text">Profit & margin analysis across your business</div></div></div>
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

      <div className="panel">
        <div className="panel-head">
          <div><h3>📦 Individual Item (Product) Profit Breakdown</h3><div className="sub-text">Detailed profit generated by every single item</div></div>
        </div>
        <div style={{marginBottom: 20}}>
          <ChartCanvas type="bar" data={{
            labels: profitByProduct.map(e=>e.name),
            datasets:[{label:'Item Profit (Rs)', data: profitByProduct.map(e=>Number(e.profit)), backgroundColor:'#2f5ef7', borderRadius:6}]
          }} options={{plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}} height={260} />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Product Name</th><th>Category</th><th>Total Units Sold</th><th>Total Profit</th></tr></thead>
            <tbody>
              {profitByProduct.length ? profitByProduct.map((p, idx)=>(
                <tr key={idx}>
                  <td className="cell-main">{p.name}</td>
                  <td>{p.category || '—'}</td>
                  <td>{p.qty || 0}</td>
                  <td><span className="tag paid">{fmt(p.profit)}</span></td>
                </tr>
              )) : <tr><td colSpan="4" className="empty-state">No product profit records found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div><h3>👥 Individual Client Profit Breakdown</h3><div className="sub-text">Detailed profit generated from each customer separately</div></div>
        </div>
        <div style={{marginBottom: 20}}>
          <ChartCanvas type="bar" data={{
            labels: profitByCustomer.map(e=>e.client_name),
            datasets:[{label:'Client Profit (Rs)', data: profitByCustomer.map(e=>Number(e.profit)), backgroundColor:'#00c2b2', borderRadius:6}]
          }} options={{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true}}}} height={260} />
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client Name</th><th>Total Profit Generated</th></tr></thead>
            <tbody>
              {profitByCustomer.length ? profitByCustomer.map((c, idx)=>(
                <tr key={idx}>
                  <td className="cell-main">{c.client_name}</td>
                  <td><span className="tag paid">{fmt(c.profit)}</span></td>
                </tr>
              )) : <tr><td colSpan="2" className="empty-state">No client profit records found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Revenue vs Cost vs Profit Summary</h3></div>
        <ChartCanvas type="bar" data={{labels:['Revenue','Cost','Profit'],datasets:[{data:[summary.totalSales, summary.totalSales-summary.totalProfit, summary.totalProfit],backgroundColor:['#2f5ef7','#ff4d5e','#22c55e'],borderRadius:8}]}}
          options={{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}} height={220} />
      </div>
    </section>
  );
}

/* ---------- Product Modal ---------- */
function ProductModal({product, categories, onSave, onClose}){
  const allCategories = [...new Set([...FIXED_CATEGORIES, ...categories])];
  const isCustomInitial = product && product.category && !allCategories.includes(product.category);

  const [form, setForm] = useState(product ? {
    name: product.name, category: product.category, stock: product.stock,
    purchase_price: product.purchase_price, selling_price: product.selling_price, threshold: product.threshold
  } : {name:'',category:'',stock:0,purchase_price:0,selling_price:0,threshold:5});
  const [categoryMode, setCategoryMode] = useState(isCustomInitial ? 'custom' : 'preset');
  const [saving, setSaving] = useState(false);
  const set = (k,v)=>setForm({...form,[k]:v});

  const submit = async () => {
    if(!form.name.trim()){ alert('Product name required'); return; }
    if(!form.category.trim()){ alert('Please select or type a category'); return; }
    setSaving(true);
    try {
      await onSave({...form, stock:Number(form.stock)||0, purchase_price:Number(form.purchase_price)||0, selling_price:Number(form.selling_price)||0, threshold:Number(form.threshold)||5}, product?product.id:null);
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
            <div className="form-group">
              <label>Category</label>
              <select
                value={categoryMode==='custom' ? '__custom__' : form.category}
                onChange={e=>{
                  if(e.target.value==='__custom__'){ setCategoryMode('custom'); set('category',''); }
                  else { setCategoryMode('preset'); set('category', e.target.value); }
                }}
              >
                <option value="">Select category</option>
                {allCategories.map(c=><option key={c} value={c}>{c}</option>)}
                <option value="__custom__">+ Custom Category...</option>
              </select>
              {categoryMode==='custom' && (
                <input style={{marginTop:8}} value={form.category} onChange={e=>set('category', e.target.value)} placeholder="Type your own category name" />
              )}
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

/* ---------- Sale Modal (with inline "New Customer" option) ---------- */
function SaleModal({products, clients, onCreateClient, onSave, onClose}){
  const NEW_CUSTOMER = '__new__';
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [newClientForm, setNewClientForm] = useState({name:'',cnic:'',phone:'',email:'',address:''});
  const [newClientError, setNewClientError] = useState('');
  const isNewCustomer = clientId === NEW_CUSTOMER;

  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [items, setItems] = useState([{productId: products[0]?.id || '', qty:1}]);
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [saving, setSaving] = useState(false);

  const setNewClientField = (k,v) => setNewClientForm({...newClientForm,[k]:v});

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
    setSaving(true);
    try {
      let finalClientId = clientId;

      if (isNewCustomer) {
        if(!newClientForm.name.trim()){ alert('Customer name is required'); setSaving(false); return; }
        const cnicDigits = newClientForm.cnic.replace(/\D/g,'');
        if(cnicDigits.length !== 13){ setNewClientError('ID card number must be exactly 13 digits.'); setSaving(false); return; }
        setNewClientError('');
        const created = await onCreateClient({...newClientForm, cnic:cnicDigits});
        finalClientId = created.id;
      }

      if(!finalClientId){ alert('Select a client'); setSaving(false); return; }
      if(items.length===0){ alert('Add at least one product'); setSaving(false); return; }

      await onSave({
        client_id: Number(finalClientId),
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
                <option value={NEW_CUSTOMER}>+ New Customer...</option>
              </select>
            </div>
            <div className="form-group"><label>Payment Method</label>
              <select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>
                <option>Cash</option><option>Card</option><option>Credit</option>
              </select>
            </div>
          </div>

          {isNewCustomer && (
            <div className="sale-items-box" style={{marginBottom:16}}>
              <div style={{fontWeight:700, fontSize:13, marginBottom:10, color:'var(--primary)'}}>New Customer Details</div>
              <div className="form-group"><label>Full Name</label><input value={newClientForm.name} onChange={e=>setNewClientField('name',e.target.value)} placeholder="e.g. Ahmed Traders" /></div>
              <div className="form-group">
                <label>ID Card Number (CNIC — 13 digits, unique)</label>
                <input value={newClientForm.cnic} maxLength={13} onChange={e=>setNewClientField('cnic', e.target.value.replace(/\D/g,''))} placeholder="e.g. 3520112345671" />
                {newClientError && <div className="field-error">{newClientError}</div>}
              </div>
              <div className="form-row">
                <div className="form-group"><label>Phone Number</label><input value={newClientForm.phone} onChange={e=>setNewClientField('phone',e.target.value)} placeholder="03xx-xxxxxxx" /></div>
                <div className="form-group"><label>Email</label><input value={newClientForm.email} onChange={e=>setNewClientField('email',e.target.value)} placeholder="client@email.com" /></div>
              </div>
              <div className="form-group"><label>Address</label><input value={newClientForm.address} onChange={e=>setNewClientField('address',e.target.value)} placeholder="City, area..." /></div>
            </div>
          )}

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
root.render(<ErrorBoundary><App /></ErrorBoundary>);