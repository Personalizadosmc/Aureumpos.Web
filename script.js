// ==========================
// LÓGICA JAVASCRIPT
// ==========================

const BASE_URL = 'https://aureumpos.onrender.com';
let token = localStorage.getItem('token');
let usuarioActual = null;
let isAdmin = false;
let categoriasCache = [];
let productosAdminCache = []; 

const formatearMoneda = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return "RD$ 0.00";
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount).replace('DOP', 'RD$');
};

// Funciones para mostrar/ocultar el cargando
function mostrarCargando() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.classList.remove('d-none'); // Quita la clase que lo oculta
        loader.style.display = 'flex';     // Asegura que se vea centrado
    }
}

function ocultarCargando() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.classList.add('d-none');    // Vuelve a ocultarlo
        loader.style.display = 'none';
    }
}

function mostrarToast(mensaje, tipo = 'info') {
  const div = document.createElement('div');
  const color = tipo === 'error' ? 'bg-danger' : tipo === 'success' ? 'bg-success' : 'bg-primary';
  div.className = `toast position-fixed top-0 end-0 m-3 align-items-center text-white ${color} border-0 shadow`;
  div.style.zIndex = '1100';
  div.innerHTML = `<div class="d-flex"><div class="toast-body fs-6">${mensaje}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  document.body.appendChild(div);
  const toast = new bootstrap.Toast(div);
  toast.show();
  setTimeout(() => div.remove(), 4000);
}

async function fetchWithAuth(endpoint, options = {}) {
  // 1. MOSTRAR EL SPINNER AL INICIAR
  mostrarCargando();

  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  options.headers = headers;

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    
    // Si no hay contenido (204), retornamos null
    if (response.status === 204) return null;

    if (!response.ok) {
      if (response.status === 401) { 
        cerrarSesion(); 
        throw new Error("Sesión caducada"); 
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Error ${response.status}`);
    }
    
    return await response.json();

  } catch (error) { 
    console.error("API Error:", error); 
    throw error; 

  } finally {
    // 2. OCULTAR EL SPINNER SIEMPRE (Haya éxito o error)
    ocultarCargando();
  }
}

async function inicializarApp() {
  await cargarCategorias(); 
  if (token) {
    try {
      usuarioActual = await fetchWithAuth('/auth/me');
      isAdmin = usuarioActual.is_admin;
      actualizarInterfazLogueada();
    } catch (e) { cerrarSesion(); }
  } else {
    actualizarInterfazInvitado();
  }
  irASeccion('portada');
}

function actualizarInterfazLogueada() {
  document.getElementById('authButtonsContainer').classList.add('d-none');
  document.getElementById('userDropdownContainer').classList.remove('d-none');
  document.getElementById('userNameNav').textContent = usuarioActual.first_name;
  document.getElementById('btnAdminNav').classList.toggle('d-none', !isAdmin);
  actualizarContadorCarrito();
}

function actualizarInterfazInvitado() {
  document.getElementById('authButtonsContainer').classList.remove('d-none');
  document.getElementById('userDropdownContainer').classList.add('d-none');
  document.getElementById('btnAdminNav').classList.add('d-none');
  document.getElementById('cartCount').textContent = '0';
}

function irASeccion(id) {
  document.querySelectorAll('.seccion').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  
  document.querySelectorAll('.nav-pill-custom').forEach(l => l.classList.remove('active'));
  if(id === 'portada') document.querySelector('.nav-pill-custom').classList.add('active');

  if (id === 'carrito') cargarCarrito();
  if (id === 'historial') cargarHistorialCotizaciones();
  if (id === 'pago') document.getElementById('totalPago').textContent = document.getElementById('totalCarrito').textContent;
  if (id === 'adminPanel' && isAdmin) { cargarCategoriasAdmin(); cargarProductosAdmin(); }
  window.scrollTo(0,0);
}

// --- MENU Y CATEGORIAS ---
async function cargarCategorias() {
  try {
    categoriasCache = await fetchWithAuth('/categories');
    const navContainer = document.getElementById('navCategoriasHeader');
    const mobileContainer = document.getElementById('navCategoriasMobile');
    
    navContainer.innerHTML = `<a class="nav-pill-custom active" onclick="irASeccion('portada')"><i class="bi bi-house-door-fill"></i> Inicio</a>`;
    mobileContainer.innerHTML = `<a href="#" class="text-dark text-decoration-none py-1 fw-bold" onclick="irASeccion('portada')">Inicio</a>`;
    
    if (categoriasCache.length > 0) {
      categoriasCache.forEach(cat => {
          const link = document.createElement('a');
          link.className = 'nav-pill-custom';
          link.textContent = cat.name;
          link.onclick = () => {
              cargarProductos(cat.id);
              document.querySelectorAll('.nav-pill-custom').forEach(l => l.classList.remove('active'));
              link.classList.add('active');
          };
          navContainer.appendChild(link);

          const linkMob = document.createElement('a');
          linkMob.className = 'text-dark text-decoration-none py-1';
          linkMob.textContent = cat.name;
          linkMob.onclick = () => { cargarProductos(cat.id); };
          mobileContainer.appendChild(linkMob);
      });
      const contactLink = document.createElement('a');
      contactLink.className = 'nav-pill-custom';
      contactLink.innerHTML = '<i class="bi bi-phone"></i> Contacto';
      contactLink.href = "mailto:contacto@aureumpos.com";
      navContainer.appendChild(contactLink);
    }

    const containerGrid = document.getElementById('listaCategorias');
    containerGrid.innerHTML = '';
    categoriasCache.forEach(cat => {
      const div = document.createElement('div');
      div.className = 'col-md-4 col-lg-3';
      div.innerHTML = `
        <div class="card category-card h-100" style="cursor:pointer;" onclick="cargarProductos(${cat.id})">
          <img src="${cat.image_url}" class="card-img-top" alt="${cat.name}" onerror="this.src='https://via.placeholder.com/300?text=Aureum'">
          <div class="card-body text-center"><h5 class="fw-bold mb-0 text-dark">${cat.name}</h5></div>
        </div>`;
      containerGrid.appendChild(div);
    });
  } catch (e) { console.error(e); }
}

async function cargarProductos(catId) {
  try {
    const prods = await fetchWithAuth(`/products?category_id=${catId}`);
    const catNombre = categoriasCache.find(c => c.id == catId)?.name || 'Productos';
    mostrarProductos(prods, catNombre);
  } catch (e) { mostrarToast('Error al cargar productos', 'error'); }
}

// Buscador Principal
let searchTimeout;
async function buscarProductosEnTiempoReal() {
  clearTimeout(searchTimeout);
  const term = document.getElementById('searchInput').value.trim();
  if (term.length === 0) {
     document.getElementById('contenedorCategoriasHome').classList.remove('d-none');
     document.getElementById('resultadosBusqueda').classList.add('d-none');
     return;
  }
  searchTimeout = setTimeout(async () => {
    try {
      const prods = await fetchWithAuth(`/products?search=${term}`);
      document.getElementById('contenedorCategoriasHome').classList.add('d-none');
      document.getElementById('resultadosBusqueda').classList.remove('d-none');
      document.getElementById('tituloResultados').textContent = `Resultados para "${term}"`;
      const container = document.getElementById('productosResultados');
      container.innerHTML = '';
      if(!prods.length) { container.innerHTML = '<p class="text-muted">No se encontraron productos.</p>'; return; }
      prods.forEach(p => renderProductoCard(p, container));
    } catch (e) { console.error(e); }
  }, 300);
}

function mostrarProductos(productos, titulo) {
  const container = document.getElementById('listaProductos');
  document.getElementById('tituloCategoria').textContent = titulo;
  container.innerHTML = '';
  if (!productos || !productos.length) {
    container.innerHTML = '<div class="col-12 text-center text-muted">No hay productos en esta categoría.</div>';
  } else {
    productos.forEach(p => renderProductoCard(p, container));
  }
  irASeccion('productos');
}

function renderProductoCard(p, container) {
    const div = document.createElement('div');
    div.className = 'col-md-6 col-lg-3';
    div.innerHTML = `
      <div class="card product-card h-100">
        <img src="${p.image_url}" class="card-img-top" onerror="this.src='https://via.placeholder.com/300?text=Producto'">
        <div class="card-body d-flex flex-column text-center">
          <h5 class="card-title text-truncate fw-bold">${p.name}</h5>
          <p class="text-success fs-5 fw-bold">${formatearMoneda(p.price)}</p>
          <button class="btn btn-warning mt-auto w-100 fw-bold" onclick="agregarAlCarrito(${p.id})">Agregar +</button>
        </div>
      </div>`;
    container.appendChild(div);
}

// --- AUTH Y CARRITO ---
async function iniciarSesion() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPass').value;
  try {
    const data = await fetchWithAuth('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    token = data.access_token;
    localStorage.setItem('token', token);
    await inicializarApp();
    mostrarToast('¡Bienvenido!', 'success');
  } catch (e) { mostrarToast('Credenciales incorrectas', 'error'); }
}

async function registrarUsuario() {
  const payload = {
    email: document.getElementById('regEmail').value,
    password: document.getElementById('regPass').value,
    first_name: document.getElementById('regNombre').value,
    last_name: document.getElementById('regApellido').value,
    address: document.getElementById('regDireccion').value,
    phone: document.getElementById('regTelefono').value
  };
  try {
    await fetchWithAuth('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    mostrarToast('Registro exitoso', 'success');
    irASeccion('login');
  } catch(e) { mostrarToast('Error: ' + e.message, 'error'); }
}

function cerrarSesion() {
  token = null; usuarioActual = null; isAdmin = false;
  localStorage.removeItem('token');
  actualizarInterfazInvitado();
  irASeccion('portada');
}

// --- FUNCIÓN CARGAR CARRITO ---
async function cargarCarrito() {
  if (!token) return;
  try {
    const cart = await fetchWithAuth('/carts');
    if (cart.items && cart.items.length > 0) {
        cart.items.sort((a, b) => a.id - b.id);
    }
    const tbody = document.getElementById('listaCarrito');
    tbody.innerHTML = '';
    let total = 0; let count = 0;
    if (!cart || !cart.items || !cart.items.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Carrito vacío</td></tr>';
      document.getElementById('totalCarrito').textContent = "RD$ 0.00";
      document.getElementById('cartCountHeader').textContent = "0 items";
      return;
    }
    
    cart.items.forEach(item => {
      // Calcular subtotal manualmente para evitar errores si el backend no lo envía
      const precio = parseFloat(item.unit_price) || 0;
      const cantidad = parseInt(item.quantity) || 0;
      const subtotalItem = precio * cantidad;

      total += subtotalItem; 
      count += cantidad;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.product ? item.product.name : 'Item'}</td>
        <td class="text-center">${formatearMoneda(precio)}</td>
        <td class="text-center">
           <div class="input-group input-group-sm justify-content-center" style="width:100px; margin:auto">
             <button class="btn btn-outline-secondary" onclick="cambiarCantidad(${item.id}, ${item.quantity - 1})">-</button>
             <input type="text" class="form-control text-center px-0" value="${item.quantity}" readonly>
             <button class="btn btn-outline-secondary" onclick="cambiarCantidad(${item.id}, ${item.quantity + 1})">+</button>
           </div>
        </td>
        <td class="text-center fw-bold">${formatearMoneda(subtotalItem)}</td>
        <td class="text-center"><button class="btn btn-sm btn-outline-danger border-0" onclick="eliminarItem(${item.id})"><i class="bi bi-trash"></i></button></td>
      `;
      tbody.appendChild(tr);
    });
    document.getElementById('totalCarrito').textContent = formatearMoneda(total);
    document.getElementById('cartCountHeader').textContent = `${count} items`;
    document.getElementById('cartCount').textContent = count;
    
    if(document.getElementById('pago').classList.contains('active')) {
        document.getElementById('totalPago').textContent = formatearMoneda(total);
    }
  } catch (e) { console.error(e); }
}

async function agregarAlCarrito(productId) {
  if (!token) { irASeccion('login'); return mostrarToast('Inicia sesión primero', 'error'); }
  try {
    await fetchWithAuth('/carts/items', { method: 'POST', body: JSON.stringify({ product_id: productId, quantity: 1 }) });
    mostrarToast('Agregado al carrito', 'success');
    actualizarContadorCarrito();
  } catch (e) { mostrarToast('Error al agregar', 'error'); }
}

async function cambiarCantidad(itemId, cant) {
  if (cant < 1) return eliminarItem(itemId);
  try { await fetchWithAuth(`/carts/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ quantity: cant }) }); cargarCarrito(); } catch (e) {}
}

async function eliminarItem(itemId) {
  if (!confirm('¿Eliminar?')) return;
  try { await fetchWithAuth(`/carts/items/${itemId}`, { method: 'DELETE' }); cargarCarrito(); actualizarContadorCarrito(); } catch (e) {}
}

async function vaciarCarrito() {
  if (!confirm('¿Vaciar carrito?')) return;
  try { await fetchWithAuth('/carts', { method: 'DELETE' }); cargarCarrito(); actualizarContadorCarrito(); } catch (e) {}
}

async function actualizarContadorCarrito() {
  if (!token) return;
  try { const c = await fetchWithAuth('/carts'); const count = c.items ? c.items.reduce((acc,i)=>acc+i.quantity,0) : 0; document.getElementById('cartCount').textContent = count; } catch(e){}
}

async function procesarPago() {
    mostrarToast('Procesando pago...', 'info');
    setTimeout(async () => {
      await fetchWithAuth('/carts', { method: 'DELETE' });
      actualizarContadorCarrito();
      irASeccion('portada');
      mostrarToast('¡Pago exitoso!', 'success');
    }, 1500);
}

// --- COTIZACIONES ---
async function crearYDescargarCotizacion() {
  try {
    mostrarToast('Generando PDF...', 'info');
    const cot = await fetchWithAuth('/quotations', { method: 'POST' });
    await descargarPDF(cot.id);
  } catch (e) { mostrarToast('Error: ' + e.message, 'error'); }
}
async function descargarPDF(id) {
   try {
      const res = await fetch(`${BASE_URL}/quotations/${id}/pdf`, { headers: { 'Authorization': `Bearer ${token}` } });
      if(!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Cotizacion_${id}.pdf`; document.body.appendChild(a); a.click(); a.remove();
      mostrarToast('Descarga iniciada', 'success');
   } catch(e) { mostrarToast('Error descargando PDF', 'error'); }
}
async function cargarHistorialCotizaciones() {
    try {
        const data = await fetchWithAuth('/quotations');
        const tbody = document.getElementById('listaHistorial'); tbody.innerHTML='';
        data.sort((a,b)=>b.id-a.id).forEach(c => {
            tbody.innerHTML += `<tr><td>#${c.id}</td><td>${new Date(c.created_at).toLocaleDateString()}</td><td class="fw-bold text-success">${formatearMoneda(c.total_amount)}</td><td><button class="btn btn-sm btn-info text-white" onclick="descargarPDF(${c.id})"><i class="bi bi-download"></i> PDF</button></td></tr>`;
        });
    } catch(e){}
}

// --- ADMIN ---
async function cargarCategoriasAdmin() {
  const cats = await fetchWithAuth('/categories');
  const tb = document.getElementById('listaCategoriasAdmin'); tb.innerHTML='';
  const sel = document.getElementById('prodCategoria'); sel.innerHTML='<option value="">Elegir...</option>';
  cats.forEach(c => {
     tb.innerHTML += `<tr><td>${c.name}</td><td><button class="btn btn-sm btn-warning me-1" onclick="editarCat(${c.id}, '${c.name}', '${c.image_url}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-danger" onclick="borrarCat(${c.id})"><i class="bi bi-trash"></i></button></td></tr>`;
     sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });
}

async function cargarProductosAdmin() {
    productosAdminCache = await fetchWithAuth('/products');
    mostrarProductosAdmin(productosAdminCache);
}

function mostrarProductosAdmin(prods) {
    const tb = document.getElementById('listaProductosAdmin'); 
    tb.innerHTML='';
    if(prods.length === 0) {
      tb.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay productos que coincidan.</td></tr>';
      return;
    }
    prods.forEach(p => {
        tb.innerHTML += `<tr>
          <td>${p.category_id}</td>
          <td>${p.name}</td>
          <td>${formatearMoneda(p.price)}</td>
          <td>
              <button class="btn btn-sm btn-warning me-1" onclick="editarProd(${p.id}, ${p.category_id}, '${p.name}', ${p.price}, '${p.image_url}')"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-danger" onclick="borrarProd(${p.id})"><i class="bi bi-trash"></i></button>
          </td>
        </tr>`;
    });
}

// Buscador Admin
function buscarProductoAdminEnTiempoReal() {
    const term = document.getElementById('adminSearchProd').value.toLowerCase();
    const filtrados = productosAdminCache.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.category_id.toString().includes(term)
    );
    mostrarProductosAdmin(filtrados);
}

// Helpers Admin
function prepararFormularioCategoria() { document.getElementById('formCategoria').reset(); document.getElementById('catId').value=''; new bootstrap.Modal(document.getElementById('modalCategoria')).show(); }
function editarCat(id, n, i) { document.getElementById('catNombre').value=n; document.getElementById('catImg').value=i; document.getElementById('catId').value=id; new bootstrap.Modal(document.getElementById('modalCategoria')).show(); }
async function guardarCategoria() {
    const id = document.getElementById('catId').value;
    const body = JSON.stringify({ name: document.getElementById('catNombre').value, image_url: document.getElementById('catImg').value });
    try { await fetchWithAuth(id ? `/categories/${id}` : '/categories', { method: id?'PUT':'POST', body }); bootstrap.Modal.getInstance(document.getElementById('modalCategoria')).hide(); cargarCategoriasAdmin(); cargarCategorias(); } catch(e){ alert(e.message); }
}
function prepararFormularioProducto() { document.getElementById('formProducto').reset(); document.getElementById('prodId').value=''; new bootstrap.Modal(document.getElementById('modalProducto')).show(); }
function editarProd(id, c, n, p, i) { document.getElementById('prodNombre').value=n; document.getElementById('prodPrecio').value=p; document.getElementById('prodImg').value=i; document.getElementById('prodCategoria').value=c; document.getElementById('prodId').value=id; new bootstrap.Modal(document.getElementById('modalProducto')).show(); }

async function guardarProducto() 
{
    // 1. Obtener los valores del formulario
    const id = document.getElementById('prodId').value;
    const nombreInput = document.getElementById('prodNombre').value.trim();
    const precioInput = parseFloat(document.getElementById('prodPrecio').value);
    const imgInput = document.getElementById('prodImg').value.trim();
    const catInput = parseInt(document.getElementById('prodCategoria').value);

    // 2. VALIDACIÓN DE DUPLICADOS
    // Buscamos si ya existe un producto con el mismo nombre (ignorando mayúsculas/minúsculas)
    // También verificamos 'p.id != id' para permitir guardar si estamos EDITANDO el mismo producto sin cambiar el nombre.
    const existeDuplicado = productosAdminCache.some(p => 
        p.name.toLowerCase() === nombreInput.toLowerCase() && p.id != id
    );

    if (existeDuplicado) {
        alert('🚫 Error: Ya existe un producto con este nombre. Por favor, elige otro.');
        return; // Detenemos la ejecución aquí, no se envía nada al servidor
    }

    // 3. Si no hay duplicados, preparamos los datos
    const body = JSON.stringify({ 
        name: nombreInput, 
        price: precioInput, 
        image_url: imgInput, 
        category_id: catInput 
    });

    // 4. Enviar al servidor
    try { 
        await fetchWithAuth(id ? `/products/${id}` : '/products', { method: id ? 'PUT' : 'POST', body }); 
        
        // Cerrar modal y recargar lista
        bootstrap.Modal.getInstance(document.getElementById('modalProducto')).hide(); 
        cargarProductosAdmin(); 
        mostrarToast('Producto guardado correctamente', 'success');
        
    } catch(e) { 
        alert('Error al guardar: ' + e.message); 
    }
}
async function borrarCat(id) { if(confirm('¿Borrar?')) try { await fetchWithAuth(`/categories/${id}`, { method:'DELETE' }); cargarCategoriasAdmin(); cargarCategorias(); } catch(e){ alert('No se puede borrar si tiene productos'); } }
async function borrarProd(id) { if(confirm('¿Borrar?')) try { await fetchWithAuth(`/products/${id}`, { method:'DELETE' }); cargarProductosAdmin(); } catch(e){ alert('Error al borrar'); } }

document.getElementById('numeroTarjeta').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g,'').substring(0,16).replace(/(.{4})/g, '$1 ').trim(); });


document.addEventListener('DOMContentLoaded', inicializarApp);
