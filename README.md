# sonder

**Todo tu negocio en movimiento**

Sistema de gestion comercial construido con React, TypeScript y Supabase.

## Caracteristicas

- **Dashboard** — KPIs en tiempo real, graficas de ventas, alertas de stock bajo
- **Catalogo** — Productos, categorias y proveedores con CRUD completo
- **Inventario** — Entradas, ajustes y historial de movimientos con operaciones atomicas (RPC)
- **Ventas** — Punto de venta con busqueda/escaneo de productos, carrito, descuentos y metodos de pago
- **Corte de Caja** — Cierre diario con desglose por metodo de pago y exportacion PDF
- **Reportes** — Analisis de ventas mensuales, metodos de pago, top productos; exportacion a PDF
- **Auditoria** — Registro completo de todas las acciones del sistema
- **Usuarios** — Gestion de usuarios con roles (admin/empleado)
- **Codigo de barras** — Escaneo con camara via html5-qrcode
- **Notificaciones WhatsApp** — Alertas de stock bajo via CallMeBot
- **Modo oscuro** — Con persistencia en localStorage
- **Validaciones** — Telefonos solo digitos, precios solo numeros, codigo de barras solo numeros

## Tecnologias

- React 18 + TypeScript + Vite
- Supabase (PostgreSQL, Auth, RLS, RPC functions)
- Tailwind CSS con CSS custom properties centralizadas
- Zustand (state management)
- React Hook Form + Zod (validaciones)
- Recharts (graficas)
- jsPDF + jspdf-autotable (exportacion PDF)
- html5-qrcode (escaneo de codigo de barras)
- CallMeBot API (notificaciones WhatsApp)

## Estructura

```
src/
  components/    — Componentes reutilizables (Layout, Modal, Sidebar, BarcodeScanner)
  lib/           — Utilidades (supabase, audit, whatsapp, pdf, types)
  pages/         — Paginas de la aplicacion
  store/         — Zustand stores (auth, theme)
  index.css      — Todos los estilos centralizados con CSS custom properties
```

## Configuracion

Variables de entorno en `.env`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CALLMEBOT_API_KEY=
VITE_CALLMEBOT_PHONE_NUMBER=
```

## Primer uso

1. El primer usuario registrado se convierte automaticamente en administrador
2. Los usuarios adicionales son empleados por defecto
3. Un admin puede cambiar roles y estados de usuarios

## Personalizacion

Todos los colores, fuentes, radios, sombras y textos estan centralizados en `src/index.css` mediante CSS custom properties. Modifica las variables `:root` y `.dark` para cambiar el tema completo sin tocar ningun componente.
